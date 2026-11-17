import { randomUUID } from 'node:crypto';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChannelsService } from '../channels/channels.service.js';
import {
  type CallIcePayload,
  type CallIdPayload,
  type CallInvitePayload,
  type CallSdpPayload,
} from './call-signaling.js';
import { CallKnownUsersRegistry } from './call-known-users.registry.js';
import { CallSessionStore } from './call-session.store.js';
import { ChatCallGatewayLogic } from './chat-call-gateway.logic.js';
import { type AuthedSocket, ensureSocketJwtValid } from './chat-socket-auth.js';
import { UsersService } from '../users/users.service.js';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:3001',
    ],
    credentials: true,
  },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);
  private readonly callLogic: ChatCallGatewayLogic;

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ChannelsService) private readonly channels: ChannelsService,
    @Inject(CallSessionStore) private readonly callSessions: CallSessionStore,
    @Inject(CallKnownUsersRegistry) private readonly knownUsers: CallKnownUsersRegistry,
    @Inject(UsersService) private readonly users: UsersService,
  ) {
    this.callLogic = new ChatCallGatewayLogic(callSessions);
  }

  private async requireAuth(client: AuthedSocket): Promise<boolean> {
    return ensureSocketJwtValid(client, this.jwt, (userId) => this.endCallsForUser(userId));
  }

  async handleConnection(client: AuthedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const secret = process.env.JWT_ACCESS_SECRET;
      if (!secret) {
        client.disconnect();
        return;
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret,
      });
      client.userId = payload.sub;
      client.authToken = token;
      this.knownUsers.register(payload.sub);
      await client.join(`user:${payload.sub}`);
      this.server.emit('presence:update', {
        userId: payload.sub,
        status: 'online',
      });
      client.on('disconnect', () => {
        this.endCallsForUser(payload.sub);
        this.server.emit('presence:update', {
          userId: payload.sub,
          status: 'offline',
        });
      });
      this.logger.debug(`WS connected user=${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  private async isUserOnline(userId: string): Promise<boolean> {
    const sockets = await this.server.in(`user:${userId}`).fetchSockets();
    return sockets.length > 0;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private peerUserId(session: { callerId: string; calleeId: string }, userId: string) {
    return session.callerId === userId ? session.calleeId : session.callerId;
  }

  private endCallsForUser(userId: string) {
    const outcome = this.callLogic.endCallsOnUserDisconnect(userId);
    for (const ended of outcome.ended) {
      const payload = { callId: ended.callId, reason: ended.reason };
      this.server.to(this.userRoom(ended.callerId)).emit('call:ended', payload);
      this.server.to(this.userRoom(ended.calleeId)).emit('call:ended', payload);
    }
  }

  private flushExpiredSessions() {
    const ringing = this.callLogic.expireStaleRingingSessions();
    for (const item of ringing.expired) {
      const payload = { callId: item.callId, reason: item.reason };
      this.server.to(this.userRoom(item.callerId)).emit('call:ended', payload);
      this.server.to(this.userRoom(item.calleeId)).emit('call:cancelled', payload);
    }
    const active = this.callLogic.expireStaleActiveSessions();
    for (const item of active.expired) {
      const payload = { callId: item.callId, reason: item.reason };
      this.server.to(this.userRoom(item.callerId)).emit('call:ended', payload);
      this.server.to(this.userRoom(item.calleeId)).emit('call:ended', payload);
    }
  }

  private notifyCallEnded(
    callId: string,
    callerId: string,
    calleeId: string,
    reason: string,
  ) {
    const payload = { callId, reason };
    this.server.to(this.userRoom(callerId)).emit('call:ended', payload);
    this.server.to(this.userRoom(calleeId)).emit('call:ended', payload);
    this.callSessions.remove(callId);
  }

  @SubscribeMessage('channel:join')
  async joinChannel(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!(await this.requireAuth(client))) return { ok: false };
    if (!client.userId) {
      for (let i = 0; i < 20 && !client.userId; i++) {
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    if (!client.userId) return { ok: false };
    await this.channels.assertMember(
      BigInt(body.channelId),
      BigInt(client.userId),
    );
    await client.join(`channel:${body.channelId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing:start')
  typingStart(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!client.userId) return;
    client.to(`channel:${body.channelId}`).emit('typing:update', {
      channelId: body.channelId,
      userId: client.userId,
      typing: true,
    });
  }

  @SubscribeMessage('typing:stop')
  typingStop(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { channelId: string },
  ) {
    if (!client.userId) return;
    client.to(`channel:${body.channelId}`).emit('typing:update', {
      channelId: body.channelId,
      userId: client.userId,
      typing: false,
    });
  }

  @SubscribeMessage('call:invite')
  async inviteCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallInvitePayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    this.flushExpiredSessions();
    let calleeInDirectory = false;
    try {
      calleeInDirectory = !!(await this.users.findById(BigInt(body.calleeUserId)));
    } catch {
      calleeInDirectory = false;
    }
    const serverCallId = randomUUID();
    if (!calleeInDirectory) {
      client.emit('call:unavailable', {
        callId: serverCallId,
        calleeUserId: body.calleeUserId,
      });
      return { ok: false, error: 'offline' };
    }
    const calleeOnline = await this.isUserOnline(body.calleeUserId);
    const result = this.callLogic.evaluateInvite(
      client.userId,
      {
        ...body,
        callId: serverCallId,
        fromUserId: client.userId,
      },
      calleeOnline,
    );
    if (!result.ok) {
      if (result.emitToCaller) {
        client.emit(result.emitToCaller.event, result.emitToCaller.payload);
      }
      return { ok: false, error: result.error };
    }
    this.server.to(this.userRoom(body.calleeUserId)).emit('call:incoming', result.notifyCallee);
    return { ok: true, callId: result.callId };
  }

  @SubscribeMessage('call:accept')
  async acceptCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallIdPayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    this.flushExpiredSessions();
    const auth = this.callLogic.evaluateAccept(client.userId, body);
    if (!auth.ok) return auth;
    const session = auth.session!;
    this.callSessions.updateState(body.callId, 'active');
    this.server.to(this.userRoom(session.callerId)).emit('call:accepted', {
      callId: body.callId,
      calleeUserId: session.calleeId,
    });
    return { ok: true };
  }

  @SubscribeMessage('call:reject')
  async rejectCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallIdPayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    this.flushExpiredSessions();
    const auth = this.callLogic.evaluateRejectCall(client.userId, body);
    if (!auth.ok) return auth;
    const session = auth.session!;
    this.server.to(this.userRoom(session.callerId)).emit('call:rejected', {
      callId: body.callId,
    });
    this.callSessions.remove(body.callId);
    return { ok: true };
  }

  @SubscribeMessage('call:cancel')
  async cancelCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallIdPayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    this.flushExpiredSessions();
    const auth = this.callLogic.evaluateCalleeAction(client.userId, body, 'participant');
    if (!auth.ok) return auth;
    const session = auth.session!;
    if (session.state !== 'ringing') {
      return { ok: false, error: 'not_found' };
    }
    if (session.callerId !== client.userId) {
      return { ok: false, error: 'forbidden' };
    }
    this.server.to(this.userRoom(session.calleeId)).emit('call:cancelled', {
      callId: body.callId,
    });
    this.callSessions.remove(body.callId);
    return { ok: true };
  }

  @SubscribeMessage('call:end')
  async endCall(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallIdPayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    this.flushExpiredSessions();
    const auth = this.callLogic.evaluateCalleeAction(client.userId, body, 'participant');
    if (!auth.ok) return auth;
    const session = auth.session!;
    this.notifyCallEnded(body.callId, session.callerId, session.calleeId, 'hangup');
    return { ok: true };
  }

  @SubscribeMessage('call:offer')
  async relayOffer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallSdpPayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    const result = this.callLogic.evaluateSdpRelay(client.userId, body);
    if (!result.ok) return result;
    this.server.to(this.userRoom(result.peerId!)).emit('call:offer', {
      callId: body.callId,
      sdp: body.sdp,
      fromUserId: client.userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('call:answer')
  async relayAnswer(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallSdpPayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    const result = this.callLogic.evaluateSdpRelay(client.userId, body);
    if (!result.ok) return result;
    this.server.to(this.userRoom(result.peerId!)).emit('call:answer', {
      callId: body.callId,
      sdp: body.sdp,
      fromUserId: client.userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('call:ice')
  async relayIce(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: CallIcePayload,
  ) {
    if (!(await this.requireAuth(client))) return { ok: false, error: 'unauthorized' };
    const result = this.callLogic.evaluateIceRelay(client.userId, body);
    if (!result.ok) return result;
    this.server.to(this.userRoom(result.peerId!)).emit('call:ice', {
      callId: body.callId,
      candidate: body.candidate,
      fromUserId: client.userId,
    });
    return { ok: true };
  }

  emitMessage(channelId: string, message: unknown) {
    this.server.to(`channel:${channelId}`).emit('message:new', message);
  }
}