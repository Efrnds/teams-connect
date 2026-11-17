import { describe, expect, it } from 'vitest';
import {
  assertCalleeForSession,
  assertCalleeNotSelf,
  assertSenderMatches,
  isSessionParticipant,
  type CallSession,
} from './call-signaling.js';

const session: CallSession = {
  callId: 'c1',
  callerId: '1',
  calleeId: '2',
  state: 'ringing',
  createdAt: Date.now(),
};

describe('call-signaling validation', () => {
  it('rejects missing or mismatched fromUserId', () => {
    expect(assertSenderMatches('1', '2')).toBe(false);
    expect(assertSenderMatches(undefined, '1')).toBe(false);
    expect(assertSenderMatches('1', undefined)).toBe(true);
    expect(assertSenderMatches('1', '1')).toBe(true);
  });

  it('rejects self-call', () => {
    expect(assertCalleeNotSelf('1', '1')).toBe(false);
    expect(assertCalleeNotSelf('1', '2')).toBe(true);
  });

  it('checks session roles', () => {
    expect(isSessionParticipant(session, '1')).toBe(true);
    expect(isSessionParticipant(session, '3')).toBe(false);
    expect(assertCalleeForSession(session, '2')).toBe(true);
    expect(assertCalleeForSession(session, '1')).toBe(false);
  });
});