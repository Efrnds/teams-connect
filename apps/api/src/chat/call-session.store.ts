import { Injectable } from '@nestjs/common';
import type { CallSession, CallSessionState } from './call-signaling.js';

@Injectable()
export class CallSessionStore {
  private readonly sessions = new Map<string, CallSession>();

  create(session: CallSession): boolean {
    if (this.sessions.has(session.callId)) return false;
    this.sessions.set(session.callId, session);
    return true;
  }

  get(callId: string): CallSession | undefined {
    return this.sessions.get(callId);
  }

  updateState(callId: string, state: CallSessionState): CallSession | undefined {
    const session = this.sessions.get(callId);
    if (!session) return undefined;
    session.state = state;
    return session;
  }

  remove(callId: string): void {
    this.sessions.delete(callId);
  }

  findRingingForUser(userId: string): CallSession | undefined {
    for (const session of this.sessions.values()) {
      if (
        session.state === 'ringing' &&
        (session.callerId === userId || session.calleeId === userId)
      ) {
        return session;
      }
    }
    return undefined;
  }

  findActiveOrRingingForUser(userId: string): CallSession[] {
    const matches: CallSession[] = [];
    for (const session of this.sessions.values()) {
      if (
        (session.state === 'ringing' || session.state === 'active') &&
        (session.callerId === userId || session.calleeId === userId)
      ) {
        matches.push(session);
      }
    }
    return matches;
  }
}