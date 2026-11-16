export type CallPhase =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'connecting'
  | 'active'
  | 'ended';

export type CallPeer = {
  userId: string;
  displayName: string;
};

export type CallIncomingPayload = {
  callId: string;
  callerUserId: string;
};

export type CallUnavailablePayload = {
  callId: string;
  calleeUserId: string;
};