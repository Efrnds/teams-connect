export type CallSessionState = 'ringing' | 'active' | 'ended';
export type CallSession = {
    callId: string;
    callerId: string;
    calleeId: string;
    state: CallSessionState;
    createdAt: number;
};
export type CallInvitePayload = {
    callId: string;
    calleeUserId: string;
    fromUserId?: string;
};
export type CallIdPayload = {
    callId: string;
    fromUserId?: string;
};
export type SessionDescriptionPayload = {
    type?: 'offer' | 'answer' | 'pranswer' | 'rollback';
    sdp?: string;
};
export type IceCandidatePayload = {
    candidate?: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
};
export type CallSdpPayload = {
    callId: string;
    sdp: SessionDescriptionPayload;
    fromUserId?: string;
};
export type CallIcePayload = {
    callId: string;
    candidate: IceCandidatePayload | null;
    fromUserId?: string;
};
export declare function assertSenderMatches(socketUserId: string | undefined, declaredFromUserId: string | undefined): socketUserId is string;
export declare function assertCalleeNotSelf(callerId: string, calleeUserId: string): boolean;
export declare function isSessionParticipant(session: CallSession, userId: string): boolean;
export declare function assertCalleeForSession(session: CallSession, userId: string): boolean;
