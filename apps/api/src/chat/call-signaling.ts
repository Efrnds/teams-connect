export type CallSessionState = 'ringing' | 'active' | 'ended';

export type CallSession = {
  callId: string;
  callerId: string;
  calleeId: string;
  state: CallSessionState;
  createdAt: number;
  /** Preenchido ao transitar para `active` (TTL de chamada ativa no servidor). */
  activeAt?: number;
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

export function assertSenderMatches(
  socketUserId: string | undefined,
  declaredFromUserId: string | undefined,
): socketUserId is string {
  if (!socketUserId) return false;
  if (declaredFromUserId !== undefined && declaredFromUserId !== socketUserId) {
    return false;
  }
  return true;
}

/** Eventos `call:*` exigem `fromUserId` explícito e igual ao JWT do socket. */
export function assertCallSenderMatches(
  socketUserId: string | undefined,
  declaredFromUserId: string | undefined,
): socketUserId is string {
  if (!socketUserId || !declaredFromUserId) return false;
  return socketUserId === declaredFromUserId;
}

export function assertCalleeNotSelf(
  callerId: string,
  calleeUserId: string,
): boolean {
  return callerId !== calleeUserId;
}

export function isSessionParticipant(
  session: CallSession,
  userId: string,
): boolean {
  return session.callerId === userId || session.calleeId === userId;
}

export function assertCalleeForSession(
  session: CallSession,
  userId: string,
): boolean {
  return session.calleeId === userId;
}