type TurnEnv = {
  nodeEnv?: string;
  turnRestSecret?: string;
  turnUsername?: string;
  turnCredential?: string;
};

export type TurnAppendResult =
  | { kind: 'ephemeral'; username: string; credential: string; expiresAt: number }
  | { kind: 'static_dev'; username: string; credential: string }
  | { kind: 'omitted'; reason: 'production_without_rest' | 'incomplete_config' };

/** Define se TURN estático pode ser exposto; em produção exige ICE_TURN_REST_SECRET. */
export function resolveTurnCredential(
  userId: string,
  env: TurnEnv,
  buildEphemeral: (userId: string, secret: string, ttl: number) => {
    username: string;
    credential: string;
    expiresAt: number;
  },
  ttlSeconds: number,
): TurnAppendResult {
  if (env.turnRestSecret) {
    const ephemeral = buildEphemeral(userId, env.turnRestSecret, ttlSeconds);
    return { kind: 'ephemeral', ...ephemeral };
  }
  if (env.nodeEnv === 'production') {
    return { kind: 'omitted', reason: 'production_without_rest' };
  }
  if (env.turnUsername && env.turnCredential) {
    return {
      kind: 'static_dev',
      username: env.turnUsername,
      credential: env.turnCredential,
    };
  }
  return { kind: 'omitted', reason: 'incomplete_config' };
}