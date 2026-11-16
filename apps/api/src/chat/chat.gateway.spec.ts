import { describe, expect, it } from 'vitest';
import { CallSessionStore } from './call-session.store.js';
import { ChatCallGatewayLogic } from './chat-call-gateway.logic.js';
import { CALL_SIGNAL_LIMITS } from './call-signaling-limits.js';

describe('ChatCallGatewayLogic', () => {
  function logicWithSession(
    state: 'ringing' | 'active',
    callerId = '1',
    calleeId = '2',
    callId = 'call-1',
  ) {
    const store = new CallSessionStore();
    store.create({
      callId,
      callerId,
      calleeId,
      state,
      createdAt: Date.now(),
    });
    return { store, logic: new ChatCallGatewayLogic(store) };
  }

  it('rejects invite when sender is unauthorized', () => {
    const logic = new ChatCallGatewayLogic(new CallSessionStore());
    const result = logic.evaluateInvite(undefined, {
      callId: 'c1',
      calleeUserId: '2',
      fromUserId: '1',
    }, true, true);
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('rejects invite when callee is offline', () => {
    const logic = new ChatCallGatewayLogic(new CallSessionStore());
    const result = logic.evaluateInvite('1', {
      callId: 'c1',
      calleeUserId: '2',
      fromUserId: '1',
    }, false, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('offline');
      expect(result.emitToCaller?.event).toBe('call:unavailable');
    }
  });

  it('rejects invite when callee is unknown to the gateway', () => {
    const logic = new ChatCallGatewayLogic(new CallSessionStore());
    const result = logic.evaluateInvite(
      '1',
      { callId: 'c1', calleeUserId: '2', fromUserId: '1' },
      true,
      false,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('offline');
      expect(result.emitToCaller?.event).toBe('call:unavailable');
    }
  });

  it('rejects invite when callee is busy', () => {
    const { logic } = logicWithSession('active', '9', '2', 'busy-call');
    const result = logic.evaluateInvite('1', {
      callId: 'new-call',
      calleeUserId: '2',
      fromUserId: '1',
    }, true, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('busy');
      expect(result.emitToCaller?.event).toBe('call:busy');
    }
  });

  it('rejects sdp relay for forbidden participant', () => {
    const { logic } = logicWithSession('active');
    const result = logic.evaluateSdpRelay('99', {
      callId: 'call-1',
      fromUserId: '99',
      sdp: { type: 'offer', sdp: 'v=0' },
    });
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('rejects call reject when session is already active', () => {
    const { logic } = logicWithSession('active');
    const result = logic.evaluateRejectCall('2', {
      callId: 'call-1',
      fromUserId: '2',
    });
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });

  it('rejects callee accept when forbidden', () => {
    const { logic } = logicWithSession('ringing');
    const result = logic.evaluateCalleeAction(
      '1',
      { callId: 'call-1', fromUserId: '1' },
      'callee',
    );
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('ends active call on peer disconnect and clears session store', () => {
    const { store, logic } = logicWithSession('active');
    const outcome = logic.endCallsOnUserDisconnect('1');
    expect(outcome.ended).toHaveLength(1);
    expect(outcome.ended[0]?.reason).toBe('peer_disconnected');
    expect(store.get('call-1')).toBeUndefined();
  });

  it('rate-limits burst ice events', () => {
    const { logic } = logicWithSession('active');
    let rateLimited = false;
    for (let i = 0; i < CALL_SIGNAL_LIMITS.icePerWindow + 5; i++) {
      const result = logic.evaluateIceRelay('1', {
        callId: 'call-1',
        fromUserId: '1',
        candidate: { candidate: `cand-${i}` },
      });
      if (!result.ok && result.error === 'rate_limited') {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });

  it('rejects oversized invite payload', () => {
    const logic = new ChatCallGatewayLogic(new CallSessionStore());
    const result = logic.evaluateInvite(
      '1',
      {
        callId: 'c1',
        calleeUserId: '2',
        fromUserId: '1',
        extra: 'x'.repeat(CALL_SIGNAL_LIMITS.maxInviteJsonChars),
      } as Parameters<ChatCallGatewayLogic['evaluateInvite']>[1],
      true,
      true,
    );
    expect(result).toEqual({ ok: false, error: 'payload_too_large' });
  });

  it('rate-limits burst invites', () => {
    const logic = new ChatCallGatewayLogic(new CallSessionStore());
    let rateLimited = false;
    for (let i = 0; i < CALL_SIGNAL_LIMITS.invitePerWindow + 2; i++) {
      const result = logic.evaluateInvite(
        '1',
        {
          callId: `call-${i}`,
          calleeUserId: '2',
          fromUserId: '1',
        },
        true,
        true,
      );
      if (!result.ok && result.error === 'rate_limited') {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });

  it('ends ringing call on disconnect and clears session store', () => {
    const { store, logic } = logicWithSession('ringing');
    const outcome = logic.endCallsOnUserDisconnect('2');
    expect(outcome.ended).toHaveLength(1);
    expect(outcome.ended[0]?.reason).toBe('peer_disconnected');
    expect(store.get('call-1')).toBeUndefined();
  });

  it('rejects sdp relay when unauthorized', () => {
    const { logic } = logicWithSession('active');
    const result = logic.evaluateSdpRelay(undefined, {
      callId: 'call-1',
      fromUserId: '1',
      sdp: { type: 'offer', sdp: 'v=0' },
    });
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('rate-limits burst accept/reject/end control events', () => {
    const { logic } = logicWithSession('ringing');
    let rateLimited = false;
    for (let i = 0; i < CALL_SIGNAL_LIMITS.controlPerWindow + 2; i++) {
      const result = logic.evaluateCalleeAction(
        '2',
        { callId: 'call-1', fromUserId: '2' },
        'callee',
      );
      if (!result.ok && result.error === 'rate_limited') {
        rateLimited = true;
        break;
      }
    }
    expect(rateLimited).toBe(true);
  });

  it('rate-limits repeated invites to the same callee', () => {
    const store = new CallSessionStore();
    const logic = new ChatCallGatewayLogic(store);
    for (let i = 0; i < CALL_SIGNAL_LIMITS.inviteToCalleePerWindow; i++) {
      const ok = logic.evaluateInvite(
        '1',
        { callId: `c-${i}`, calleeUserId: '2', fromUserId: '1' },
        true,
        true,
      );
      expect(ok.ok).toBe(true);
      store.remove(`c-${i}`);
    }
    const blocked = logic.evaluateInvite(
      '1',
      { callId: 'blocked', calleeUserId: '2', fromUserId: '1' },
      true,
      true,
    );
    expect(blocked).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('expires stale ringing sessions by TTL', () => {
    const store = new CallSessionStore();
    const logic = new ChatCallGatewayLogic(store);
    store.create({
      callId: 'old-ring',
      callerId: '1',
      calleeId: '2',
      state: 'ringing',
      createdAt: Date.now() - CALL_SIGNAL_LIMITS.ringingTtlMs - 1,
    });
    const outcome = logic.expireStaleRingingSessions();
    expect(outcome.expired).toHaveLength(1);
    expect(outcome.expired[0]?.reason).toBe('ring_timeout');
    expect(store.get('old-ring')).toBeUndefined();
  });

  it('expires stale active sessions by TTL', () => {
    const store = new CallSessionStore();
    const logic = new ChatCallGatewayLogic(store);
    const started = Date.now() - CALL_SIGNAL_LIMITS.activeTtlMs - 1;
    store.create({
      callId: 'old-active',
      callerId: '1',
      calleeId: '2',
      state: 'active',
      createdAt: started,
      activeAt: started,
    });
    const outcome = logic.expireStaleActiveSessions();
    expect(outcome.expired).toHaveLength(1);
    expect(outcome.expired[0]?.reason).toBe('active_timeout');
    expect(store.get('old-active')).toBeUndefined();
  });
});