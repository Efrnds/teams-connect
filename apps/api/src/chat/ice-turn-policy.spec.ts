import { describe, expect, it } from 'vitest';
import { resolveTurnCredential } from './ice-turn-policy.js';

const fakeEphemeral = (userId: string, secret: string, ttl: number) => ({
  username: `${ttl}:${userId}`,
  credential: `hmac-${secret}`,
  expiresAt: 9_999_999,
});

describe('resolveTurnCredential', () => {
  it('omite TURN estático em produção sem REST secret', () => {
    const result = resolveTurnCredential(
      '1',
      { nodeEnv: 'production', turnUsername: 'u', turnCredential: 'p' },
      fakeEphemeral,
      3600,
    );
    expect(result).toEqual({ kind: 'omitted', reason: 'production_without_rest' });
  });

  it('permite estático só fora de produção', () => {
    const result = resolveTurnCredential(
      '1',
      { nodeEnv: 'development', turnUsername: 'u', turnCredential: 'p' },
      fakeEphemeral,
      3600,
    );
    expect(result).toEqual({
      kind: 'static_dev',
      username: 'u',
      credential: 'p',
    });
  });
});