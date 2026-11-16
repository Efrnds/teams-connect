var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
import { ConnectedSocket, MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, } from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'socket.io';
import { ChannelsService } from '../channels/channels.service.js';
import { assertCalleeForSession, assertCalleeNotSelf, assertSenderMatches, isSessionParticipant, } from './call-signaling.js';
import { CallSessionStore } from './call-session.store.js';
let ChatGateway = ChatGateway_1 = class ChatGateway {
    jwt;
    channels;
    callSessions;
    logger = new Logger(ChatGateway_1.name);
    server;
    constructor(jwt, channels, callSessions) {
        this.jwt = jwt;
        this.channels = channels;
        this.callSessions = callSessions;
    }
    async handleConnection(client) {
        try {
            const token = client.handshake.auth?.token ??
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
            const payload = await this.jwt.verifyAsync(token, {
                secret,
            });
            client.userId = payload.sub;
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
        }
        catch {
            client.disconnect();
        }
    }
    async isUserOnline(userId) {
        const sockets = await this.server.in(`user:${userId}`).fetchSockets();
        return sockets.length > 0;
    }
    userRoom(userId) {
        return `user:${userId}`;
    }
    peerUserId(session, userId) {
        return session.callerId === userId ? session.calleeId : session.callerId;
    }
    endCallsForUser(userId) {
        const session = this.callSessions.findRingingForUser(userId);
        if (!session)
            return;
        this.notifyCallEnded(session.callId, session.callerId, session.calleeId, 'peer_disconnected');
        this.callSessions.remove(session.callId);
    }
    notifyCallEnded(callId, callerId, calleeId, reason) {
        const payload = { callId, reason };
        this.server.to(this.userRoom(callerId)).emit('call:ended', payload);
        this.server.to(this.userRoom(calleeId)).emit('call:ended', payload);
        this.callSessions.remove(callId);
    }
    async joinChannel(client, body) {
        if (!client.userId) {
            for (let i = 0; i < 20 && !client.userId; i++) {
                await new Promise((r) => setTimeout(r, 25));
            }
        }
        if (!client.userId)
            return { ok: false };
        await this.channels.assertMember(BigInt(body.channelId), BigInt(client.userId));
        await client.join(`channel:${body.channelId}`);
        return { ok: true };
    }
    typingStart(client, body) {
        if (!client.userId)
            return;
        client.to(`channel:${body.channelId}`).emit('typing:update', {
            channelId: body.channelId,
            userId: client.userId,
            typing: true,
        });
    }
    typingStop(client, body) {
        if (!client.userId)
            return;
        client.to(`channel:${body.channelId}`).emit('typing:update', {
            channelId: body.channelId,
            userId: client.userId,
            typing: false,
        });
    }
    async inviteCall(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) ||
            !body.callId ||
            !body.calleeUserId) {
            return { ok: false, error: 'unauthorized' };
        }
        if (!assertCalleeNotSelf(client.userId, body.calleeUserId)) {
            return { ok: false, error: 'self_call' };
        }
        if (this.callSessions.findRingingForUser(client.userId)) {
            return { ok: false, error: 'busy' };
        }
        const calleeOnline = await this.isUserOnline(body.calleeUserId);
        if (!calleeOnline) {
            client.emit('call:unavailable', {
                callId: body.callId,
                calleeUserId: body.calleeUserId,
            });
            return { ok: false, error: 'offline' };
        }
        const created = this.callSessions.create({
            callId: body.callId,
            callerId: client.userId,
            calleeId: body.calleeUserId,
            state: 'ringing',
            createdAt: Date.now(),
        });
        if (!created) {
            return { ok: false, error: 'duplicate_call' };
        }
        this.server.to(this.userRoom(body.calleeUserId)).emit('call:incoming', {
            callId: body.callId,
            callerUserId: client.userId,
        });
    }
    acceptCall(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) || !body.callId) {
            return { ok: false, error: 'unauthorized' };
        }
        const session = this.callSessions.get(body.callId);
        if (!session || session.state !== 'ringing') {
            return { ok: false, error: 'not_found' };
        }
        if (!assertCalleeForSession(session, client.userId)) {
            return { ok: false, error: 'forbidden' };
        }
        this.callSessions.updateState(body.callId, 'active');
        this.server.to(this.userRoom(session.callerId)).emit('call:accepted', {
            callId: body.callId,
            calleeUserId: session.calleeId,
        });
        return { ok: true };
    }
    rejectCall(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) || !body.callId) {
            return { ok: false, error: 'unauthorized' };
        }
        const session = this.callSessions.get(body.callId);
        if (!session)
            return { ok: false, error: 'not_found' };
        if (!assertCalleeForSession(session, client.userId)) {
            return { ok: false, error: 'forbidden' };
        }
        this.server.to(this.userRoom(session.callerId)).emit('call:rejected', {
            callId: body.callId,
        });
        this.callSessions.remove(body.callId);
        return { ok: true };
    }
    cancelCall(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) || !body.callId) {
            return { ok: false, error: 'unauthorized' };
        }
        const session = this.callSessions.get(body.callId);
        if (!session || session.state !== 'ringing') {
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
    endCall(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) || !body.callId) {
            return { ok: false, error: 'unauthorized' };
        }
        const session = this.callSessions.get(body.callId);
        if (!session)
            return { ok: false, error: 'not_found' };
        if (!isSessionParticipant(session, client.userId)) {
            return { ok: false, error: 'forbidden' };
        }
        this.notifyCallEnded(body.callId, session.callerId, session.calleeId, 'hangup');
        return { ok: true };
    }
    relayOffer(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) || !body.callId) {
            return { ok: false, error: 'unauthorized' };
        }
        const session = this.callSessions.get(body.callId);
        if (!session || session.state !== 'active') {
            return { ok: false, error: 'not_found' };
        }
        if (!isSessionParticipant(session, client.userId)) {
            return { ok: false, error: 'forbidden' };
        }
        const peerId = this.peerUserId(session, client.userId);
        this.server.to(this.userRoom(peerId)).emit('call:offer', {
            callId: body.callId,
            sdp: body.sdp,
            fromUserId: client.userId,
        });
        return { ok: true };
    }
    relayAnswer(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) || !body.callId) {
            return { ok: false, error: 'unauthorized' };
        }
        const session = this.callSessions.get(body.callId);
        if (!session || session.state !== 'active') {
            return { ok: false, error: 'not_found' };
        }
        if (!isSessionParticipant(session, client.userId)) {
            return { ok: false, error: 'forbidden' };
        }
        const peerId = this.peerUserId(session, client.userId);
        this.server.to(this.userRoom(peerId)).emit('call:answer', {
            callId: body.callId,
            sdp: body.sdp,
            fromUserId: client.userId,
        });
        return { ok: true };
    }
    relayIce(client, body) {
        if (!assertSenderMatches(client.userId, body.fromUserId) || !body.callId) {
            return { ok: false, error: 'unauthorized' };
        }
        const session = this.callSessions.get(body.callId);
        if (!session || session.state !== 'active') {
            return { ok: false, error: 'not_found' };
        }
        if (!isSessionParticipant(session, client.userId)) {
            return { ok: false, error: 'forbidden' };
        }
        const peerId = this.peerUserId(session, client.userId);
        this.server.to(this.userRoom(peerId)).emit('call:ice', {
            callId: body.callId,
            candidate: body.candidate,
            fromUserId: client.userId,
        });
        return { ok: true };
    }
    emitMessage(channelId, message) {
        this.server.to(`channel:${channelId}`).emit('message:new', message);
    }
};
__decorate([
    WebSocketServer(),
    __metadata("design:type", typeof (_b = typeof Server !== "undefined" && Server) === "function" ? _b : Object)
], ChatGateway.prototype, "server", void 0);
__decorate([
    SubscribeMessage('channel:join'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_c = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _c : Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "joinChannel", null);
__decorate([
    SubscribeMessage('typing:start'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_d = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _d : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "typingStart", null);
__decorate([
    SubscribeMessage('typing:stop'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_e = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _e : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "typingStop", null);
__decorate([
    SubscribeMessage('call:invite'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_f = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _f : Object, Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "inviteCall", null);
__decorate([
    SubscribeMessage('call:accept'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_g = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _g : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "acceptCall", null);
__decorate([
    SubscribeMessage('call:reject'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_h = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _h : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "rejectCall", null);
__decorate([
    SubscribeMessage('call:cancel'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_j = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _j : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "cancelCall", null);
__decorate([
    SubscribeMessage('call:end'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_k = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _k : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "endCall", null);
__decorate([
    SubscribeMessage('call:offer'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_l = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _l : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "relayOffer", null);
__decorate([
    SubscribeMessage('call:answer'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_m = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _m : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "relayAnswer", null);
__decorate([
    SubscribeMessage('call:ice'),
    __param(0, ConnectedSocket()),
    __param(1, MessageBody()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [typeof (_o = typeof AuthedSocket !== "undefined" && AuthedSocket) === "function" ? _o : Object, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "relayIce", null);
ChatGateway = ChatGateway_1 = __decorate([
    WebSocketGateway({
        cors: {
            origin: process.env.CORS_ORIGIN?.split(',') ?? [
                'http://localhost:3000',
                'http://localhost:3001',
            ],
            credentials: true,
        },
        namespace: '/chat',
    }),
    __param(0, Inject(JwtService)),
    __param(1, Inject(ChannelsService)),
    __param(2, Inject(CallSessionStore)),
    __metadata("design:paramtypes", [JwtService, typeof (_a = typeof ChannelsService !== "undefined" && ChannelsService) === "function" ? _a : Object, CallSessionStore])
], ChatGateway);
export { ChatGateway };
//# sourceMappingURL=chat.gateway.js.map