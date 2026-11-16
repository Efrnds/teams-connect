import { Injectable } from '@nestjs/common';
import type { CallSession, CallSessionState } from './call-signaling.js';
import { CALL_SIGNAL_LIMITS } from './call-signaling-limits.js';

/**
 * Sessões u2u ficam em memória por processo da API.
 * Várias réplicas sem sticky WebSocket podem divergir — ver README (escala horizontal).
 */
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

  /** Remove sessões em ringing expiradas (TTL) e retorna as removidas. */
  expireStaleRinging(now = Date.now()): CallSession[] {
    const expired: CallSession[] = [];
    for (const [callId, session] of this.sessions.entries()) {
      if (session.state !== 'ringing') continue;
      if (now - session.createdAt <= CALL_SIGNAL_LIMITS.ringingTtlMs) continue;
      this.sessions.delete(callId);
      expired.push(session);
    }
    return expired;
  }
}