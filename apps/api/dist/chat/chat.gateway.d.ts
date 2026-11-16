import { OnGatewayConnection } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChannelsService } from '../channels/channels.service.js';
import { type CallIcePayload, type CallIdPayload, type CallInvitePayload, type CallSdpPayload } from './call-signaling.js';
import { CallSessionStore } from './call-session.store.js';
type AuthedSocket = Socket & {
    userId?: string;
};
export declare class ChatGateway implements OnGatewayConnection {
    private readonly jwt;
    private readonly channels;
    private readonly callSessions;
    private readonly logger;
    server: Server;
    constructor(jwt: JwtService, channels: ChannelsService, callSessions: CallSessionStore);
    handleConnection(client: AuthedSocket): Promise<void>;
    private isUserOnline;
    private userRoom;
    private peerUserId;
    private endCallsForUser;
    private notifyCallEnded;
    joinChannel(client: AuthedSocket, body: {
        channelId: string;
    }): Promise<{
        ok: boolean;
    }>;
    typingStart(client: AuthedSocket, body: {
        channelId: string;
    }): void;
    typingStop(client: AuthedSocket, body: {
        channelId: string;
    }): void;
    inviteCall(client: AuthedSocket, body: CallInvitePayload): Promise<{
        ok: boolean;
        error: string;
    } | undefined>;
    acceptCall(client: AuthedSocket, body: CallIdPayload): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    rejectCall(client: AuthedSocket, body: CallIdPayload): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    cancelCall(client: AuthedSocket, body: CallIdPayload): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    endCall(client: AuthedSocket, body: CallIdPayload): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    relayOffer(client: AuthedSocket, body: CallSdpPayload): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    relayAnswer(client: AuthedSocket, body: CallSdpPayload): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    relayIce(client: AuthedSocket, body: CallIcePayload): {
        ok: boolean;
        error: string;
    } | {
        ok: boolean;
        error?: undefined;
    };
    emitMessage(channelId: string, message: unknown): void;
}
export {};
