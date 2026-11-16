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
    }, true);
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('rejects invite when callee is offline', () => {
    const logic = new ChatCallGatewayLogic(new CallSessionStore());
    const result = logic.evaluateInvite('1', {
      callId: 'c1',
      calleeUserId: '2',
      fromUserId: '1',
    }, false);
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
    }, true);
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
});