export const CALL_SIGNAL_LIMITS = {
  invitePerWindow: 8,
  inviteToCalleePerWindow: 3,
  sdpPerWindow: 40,
  icePerWindow: 200,
  controlPerWindow: 40,
  iceFetchPerWindow: 6,
  windowMs: 10_000,
  iceFetchWindowMs: 60_000,
  ringingTtlMs: 50_000,
  /** Encerra sessões active antigas para liberar estado ocupado (busy). */
  activeTtlMs: 3_600_000,
  maxInviteJsonChars: 2_048,
  maxSdpJsonChars: 64_000,
  maxIceJsonChars: 8_192,
  maxCallIdLen: 128,
  maxCalleeIdLen: 64,
} as const;

type BucketKey = 'invite' | 'sdp' | 'ice' | 'control';

const BUCKET_LIMIT: Record<BucketKey, number> = {
  invite: CALL_SIGNAL_LIMITS.invitePerWindow,
  sdp: CALL_SIGNAL_LIMITS.sdpPerWindow,
  ice: CALL_SIGNAL_LIMITS.icePerWindow,
  control: CALL_SIGNAL_LIMITS.controlPerWindow,
};

export class CallSignalingRateLimit {
  private readonly buckets = new Map<string, number[]>();

  reset(): void {
    this.buckets.clear();
  }

  allow(userId: string, kind: BucketKey, now = Date.now()): boolean {
    const key = `${userId}:${kind}`;
    const windowStart = now - CALL_SIGNAL_LIMITS.windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter((t) => t > windowStart);
    if (timestamps.length >= BUCKET_LIMIT[kind]) {
      this.buckets.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return true;
  }

  allowInviteToCallee(callerId: string, calleeId: string, now = Date.now()): boolean {
    const key = `${callerId}->${calleeId}:invite_to`;
    const windowStart = now - CALL_SIGNAL_LIMITS.windowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter((t) => t > windowStart);
    if (timestamps.length >= CALL_SIGNAL_LIMITS.inviteToCalleePerWindow) {
      this.buckets.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return true;
  }

  allowIceFetch(userId: string, now = Date.now()): boolean {
    const key = `${userId}:ice_fetch`;
    const windowStart = now - CALL_SIGNAL_LIMITS.iceFetchWindowMs;
    const timestamps = (this.buckets.get(key) ?? []).filter((t) => t > windowStart);
    if (timestamps.length >= CALL_SIGNAL_LIMITS.iceFetchPerWindow) {
      this.buckets.set(key, timestamps);
      return false;
    }
    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return true;
  }
}

export function payloadTooLarge(jsonChars: number, max: number): boolean {
  return jsonChars > max;
}

export function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

export function isValidCallId(callId: string): boolean {
  return (
    typeof callId === 'string' &&
    callId.length > 0 &&
    callId.length <= CALL_SIGNAL_LIMITS.maxCallIdLen
  );
}