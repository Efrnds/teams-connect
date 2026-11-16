import {
  assertCalleeForSession,
  assertCalleeNotSelf,
  assertSenderMatches,
  isSessionParticipant,
  type CallIcePayload,
  type CallIdPayload,
  type CallInvitePayload,
  type CallSdpPayload,
  type CallSession,
} from './call-signaling.js';
import {
  CallSignalingRateLimit,
  CALL_SIGNAL_LIMITS,
  isValidCallId,
  jsonSize,
  payloadTooLarge,
} from './call-signaling-limits.js';
import { CallSessionStore } from './call-session.store.js';

export type InviteOutcome =
  | { ok: true; notifyCallee: { callId: string; callerUserId: string } }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'self_call'
        | 'busy'
        | 'offline'
        | 'duplicate_call'
        | 'rate_limited'
        | 'payload_too_large';
      emitToCaller?: { event: 'call:busy' | 'call:unavailable'; payload: Record<string, string> };
    };

export type SimpleCallOutcome =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'not_found' | 'forbidden' | 'rate_limited' | 'payload_too_large';
    };

export type DisconnectOutcome = {
  ended: Array<{
    callId: string;
    callerId: string;
    calleeId: string;
    reason: string;
  }>;
};

export class ChatCallGatewayLogic {
  readonly rateLimit = new CallSignalingRateLimit();

  constructor(private readonly callSessions: CallSessionStore) {}

  endCallsOnUserDisconnect(userId: string): DisconnectOutcome {
    const sessions = this.callSessions.findActiveOrRingingForUser(userId);
    const ended = sessions.map((session) => ({
      callId: session.callId,
      callerId: session.callerId,
      calleeId: session.calleeId,
      reason: 'peer_disconnected',
    }));
    for (const session of sessions) {
      this.callSessions.remove(session.callId);
    }
    return { ended };
  }

  evaluateInvite(
    clientUserId: string | undefined,
    body: CallInvitePayload,
    calleeOnline: boolean,
  ): InviteOutcome {
    if (!assertSenderMatches(clientUserId, body.fromUserId) || !body.callId || !body.calleeUserId) {
      return { ok: false, error: 'unauthorized' };
    }
    if (!isValidCallId(body.callId) || body.calleeUserId.length > CALL_SIGNAL_LIMITS.maxCalleeIdLen) {
      return { ok: false, error: 'payload_too_large' };
    }
    if (
      payloadTooLarge(jsonSize(body), CALL_SIGNAL_LIMITS.maxInviteJsonChars) ||
      !this.rateLimit.allow(clientUserId, 'invite')
    ) {
      return {
        ok: false,
        error: payloadTooLarge(jsonSize(body), CALL_SIGNAL_LIMITS.maxInviteJsonChars)
          ? 'payload_too_large'
          : 'rate_limited',
      };
    }
    if (!assertCalleeNotSelf(clientUserId, body.calleeUserId)) {
      return { ok: false, error: 'self_call' };
    }
    if (this.callSessions.findActiveOrRingingForUser(clientUserId).length > 0) {
      return { ok: false, error: 'busy' };
    }
    if (this.callSessions.findActiveOrRingingForUser(body.calleeUserId).length > 0) {
      return {
        ok: false,
        error: 'busy',
        emitToCaller: {
          event: 'call:busy',
          payload: { callId: body.callId, calleeUserId: body.calleeUserId },
        },
      };
    }
    if (!calleeOnline) {
      return {
        ok: false,
        error: 'offline',
        emitToCaller: {
          event: 'call:unavailable',
          payload: { callId: body.callId, calleeUserId: body.calleeUserId },
        },
      };
    }

    const created = this.callSessions.create({
      callId: body.callId,
      callerId: clientUserId,
      calleeId: body.calleeUserId,
      state: 'ringing',
      createdAt: Date.now(),
    });
    if (!created) {
      return { ok: false, error: 'duplicate_call' };
    }

    return {
      ok: true,
      notifyCallee: { callId: body.callId, callerUserId: clientUserId },
    };
  }

  evaluateSdpRelay(
    clientUserId: string | undefined,
    body: CallSdpPayload,
  ): SimpleCallOutcome & { peerId?: string; relay?: { callId: string; sdp: CallSdpPayload['sdp']; fromUserId: string } } {
    if (!assertSenderMatches(clientUserId, body.fromUserId) || !body.callId) {
      return { ok: false, error: 'unauthorized' };
    }
    if (
      !isValidCallId(body.callId) ||
      payloadTooLarge(jsonSize(body.sdp), CALL_SIGNAL_LIMITS.maxSdpJsonChars) ||
      !this.rateLimit.allow(clientUserId, 'sdp')
    ) {
      return {
        ok: false,
        error: payloadTooLarge(jsonSize(body.sdp), CALL_SIGNAL_LIMITS.maxSdpJsonChars)
          ? 'payload_too_large'
          : 'rate_limited',
      };
    }
    const session = this.callSessions.get(body.callId);
    if (!session || session.state !== 'active') {
      return { ok: false, error: 'not_found' };
    }
    if (!isSessionParticipant(session, clientUserId)) {
      return { ok: false, error: 'forbidden' };
    }
    const peerId = peerUserId(session, clientUserId);
    return {
      ok: true,
      peerId,
      relay: { callId: body.callId, sdp: body.sdp, fromUserId: clientUserId },
    };
  }

  evaluateIceRelay(
    clientUserId: string | undefined,
    body: CallIcePayload,
  ): SimpleCallOutcome & { peerId?: string; relay?: { callId: string; candidate: CallIcePayload['candidate']; fromUserId: string } } {
    if (!assertSenderMatches(clientUserId, body.fromUserId) || !body.callId) {
      return { ok: false, error: 'unauthorized' };
    }
    if (
      !isValidCallId(body.callId) ||
      payloadTooLarge(jsonSize(body.candidate), CALL_SIGNAL_LIMITS.maxIceJsonChars) ||
      !this.rateLimit.allow(clientUserId, 'ice')
    ) {
      return {
        ok: false,
        error: payloadTooLarge(jsonSize(body.candidate), CALL_SIGNAL_LIMITS.maxIceJsonChars)
          ? 'payload_too_large'
          : 'rate_limited',
      };
    }
    const session = this.callSessions.get(body.callId);
    if (!session || session.state !== 'active') {
      return { ok: false, error: 'not_found' };
    }
    if (!isSessionParticipant(session, clientUserId)) {
      return { ok: false, error: 'forbidden' };
    }
    const peerId = peerUserId(session, clientUserId);
    return {
      ok: true,
      peerId,
      relay: {
        callId: body.callId,
        candidate: body.candidate,
        fromUserId: clientUserId,
      },
    };
  }

  evaluateCalleeAction(
    clientUserId: string | undefined,
    body: CallIdPayload,
    role: 'callee' | 'participant',
  ): SimpleCallOutcome & { session?: CallSession } {
    if (!assertSenderMatches(clientUserId, body.fromUserId) || !body.callId) {
      return { ok: false, error: 'unauthorized' };
    }
    const session = this.callSessions.get(body.callId);
    if (!session) return { ok: false, error: 'not_found' };
    if (role === 'callee' && !assertCalleeForSession(session, clientUserId)) {
      return { ok: false, error: 'forbidden' };
    }
    if (role === 'participant' && !isSessionParticipant(session, clientUserId)) {
      return { ok: false, error: 'forbidden' };
    }
    return { ok: true, session };
  }
}

function peerUserId(session: CallSession, userId: string): string {
  return session.callerId === userId ? session.calleeId : session.callerId;
}