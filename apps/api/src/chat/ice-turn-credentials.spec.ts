import { describe, expect, it } from 'vitest';
import { buildEphemeralTurnCredentials } from './ice-turn-credentials.js';

describe('buildEphemeralTurnCredentials', () => {
  it('gera username com expiração e credential determinística', () => {
    const a = buildEphemeralTurnCredentials('42', 'test-secret', 600);
    const b = buildEphemeralTurnCredentials('42', 'test-secret', 600);
    expect(a.username).toMatch(/^\d+:42$/);
    expect(a.credential).toBe(b.credential);
    expect(a.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('muda credential para outro usuário', () => {
    const a = buildEphemeralTurnCredentials('1', 'secret', 600);
    const b = buildEphemeralTurnCredentials('2', 'secret', 600);
    expect(a.credential).not.toBe(b.credential);
  });
});