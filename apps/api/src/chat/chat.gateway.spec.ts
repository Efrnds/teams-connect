import { describe, expect, it } from 'vitest';
import { CallSessionStore } from './call-session.store.js';
import { ChatCallGatewayLogic } from './chat-call-gateway.logic.js';
import { CALL_SIGNAL_LIMITS } from './call-signaling-limits.js';

const CID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const CID_B = 'bbbbbbbb-bbbb-4ccc-8ddd-ffffffffffff';

describe('ChatCallGatewayLogic', () => {
  function logicWithSession(
    state: 'ringing' | 'active',
    callerId = '1',
    calleeId = '2',
    callId = CID,
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
      callId: 'bad-id',
      calleeUserId: '2',
      fromUserId: '1',
    }, true);
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('rejects invite when callee is offline', () => {
    const logic = new ChatCallGatewayLogic(new CallSessionStore());
    const result = logic.evaluateInvite('1', {
      callId: CID,
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
    const { logic } = logicWithSession('active', '9', '2', CID_B);
    const result = logic.evaluateInvite('1', {
      callId: CID_B,
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
      callId: CID,
      fromUserId: '99',
      sdp: { type: 'offer', sdp: 'v=0' },
    });
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('evaluateAccept only allows ringing callee', () => {
    const { logic } = logicWithSession('ringing');
    expect(logic.evaluateAccept('2', { callId: CID, fromUserId: '2' }).ok).toBe(true);
    const active = logicWithSession('active');
    expect(active.logic.evaluateAccept('2', { callId: CID, fromUserId: '2' }).ok).toBe(
      false,
    );
  });

  it('rejects call reject when session is already active', () => {
    const { logic } = logicWithSession('active');
    const result = logic.evaluateRejectCall('2', {
      callId: CID,
      fromUserId: '2',
    });
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });

  it('rejects callee accept when forbidden', () => {
    const { logic } = logicWithSession('ringing');
    const result = logic.evaluateCalleeAction(
      '1',
      { callId: CID, fromUserId: '1' },
      'callee',
    );
    expect(result).toEqual({ ok: false, error: 'forbidden' });
  });

  it('ends active call on peer disconnect and clears session store', () => {
    const { store, logic } = logicWithSession('active');
    const outcome = logic.endCallsOnUserDisconnect('1');
    expect(outcome.ended).toHaveLength(1);
    expect(outcome.ended[0]?.reason).toBe('peer_disconnected');
    expect(store.get(CID)).toBeUndefined();
  });

  it('rate-limits burst ice events', () => {
    const { logic } = logicWithSession('active');
    let rateLimited = false;
    for (let i = 0; i < CALL_SIGNAL_LIMITS.icePerWindow + 5; i++) {
      const result = logic.evaluateIceRelay('1', {
        callId: CID,
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
        callId: 'bad-id',
        calleeUserId: '2',
        fromUserId: '1',
        extra: 'x'.repeat(CALL_SIGNAL_LIMITS.maxInviteJsonChars),
      } as Parameters<ChatCallGatewayLogic['evaluateInvite']>[1],
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
          callId: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`,
          calleeUserId: '2',
          fromUserId: '1',
        },
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
    expect(store.get(CID)).toBeUndefined();
  });

  it('rejects sdp relay when unauthorized', () => {
    const { logic } = logicWithSession('active');
    const result = logic.evaluateSdpRelay(undefined, {
      callId: CID,
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
        { callId: CID, fromUserId: '2' },
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
        {
          callId: `cccccccc-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`,
          calleeUserId: '2',
          fromUserId: '1',
        },
        true,
      );
      expect(ok.ok).toBe(true);
      store.remove(`cccccccc-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`);
    }
    const blocked = logic.evaluateInvite(
      '1',
      { callId: 'dddddddd-bbbb-4ccc-8ddd-000000000001', calleeUserId: '2', fromUserId: '1' },
      true,
    );
    expect(blocked).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('expires stale ringing sessions by TTL', () => {
    const store = new CallSessionStore();
    const logic = new ChatCallGatewayLogic(store);
    store.create({
      callId: 'eeeeeeee-bbbb-4ccc-8ddd-000000000001',
      callerId: '1',
      calleeId: '2',
      state: 'ringing',
      createdAt: Date.now() - CALL_SIGNAL_LIMITS.ringingTtlMs - 1,
    });
    const outcome = logic.expireStaleRingingSessions();
    expect(outcome.expired).toHaveLength(1);
    expect(outcome.expired[0]?.reason).toBe('ring_timeout');
    expect(store.get('eeeeeeee-bbbb-4ccc-8ddd-000000000001')).toBeUndefined();
  });

  it('expires stale active sessions by TTL', () => {
    const store = new CallSessionStore();
    const logic = new ChatCallGatewayLogic(store);
    const started = Date.now() - CALL_SIGNAL_LIMITS.activeTtlMs - 1;
    store.create({
      callId: 'ffffffff-bbbb-4ccc-8ddd-000000000001',
      callerId: '1',
      calleeId: '2',
      state: 'active',
      createdAt: started,
      activeAt: started,
    });
    const outcome = logic.expireStaleActiveSessions();
    expect(outcome.expired).toHaveLength(1);
    expect(outcome.expired[0]?.reason).toBe('active_timeout');
    expect(store.get('ffffffff-bbbb-4ccc-8ddd-000000000001')).toBeUndefined();
  });
});