import type { CallSession, CallSessionState } from './call-signaling.js';
export declare class CallSessionStore {
    private readonly sessions;
    create(session: CallSession): boolean;
    get(callId: string): CallSession | undefined;
    updateState(callId: string, state: CallSessionState): CallSession | undefined;
    remove(callId: string): void;
    findRingingForUser(userId: string): CallSession | undefined;
}
