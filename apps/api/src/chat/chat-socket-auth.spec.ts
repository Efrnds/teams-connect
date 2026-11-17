import { describe, expect, it, vi } from 'vitest';
import { ensureSocketJwtValid, type AuthedSocket } from './chat-socket-auth.js';

describe('ensureSocketJwtValid', () => {
  const secret = 'test-secret-at-least-32-characters-long';

  function client(overrides: Partial<AuthedSocket> = {}): AuthedSocket {
    return {
      userId: '42',
      authToken: 'tok',
      disconnect: vi.fn(),
      ...overrides,
    } as unknown as AuthedSocket;
  }

  it('desconecta sem userId ou token', async () => {
    const c = client({ userId: undefined, authToken: undefined });
    const jwt = { verifyAsync: vi.fn() };
    await expect(ensureSocketJwtValid(c, jwt as never)).resolves.toBe(false);
    expect(c.disconnect).toHaveBeenCalled();
  });

  it('revalida JWT a cada chamada', async () => {
    const prev = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = secret;
    const c = client();
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ sub: '42' }),
    };
    await expect(ensureSocketJwtValid(c, jwt as never)).resolves.toBe(true);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('tok', { secret });
    process.env.JWT_ACCESS_SECRET = prev;
  });

  it('desconecta quando verify falha', async () => {
    const prev = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = secret;
    const c = client();
    const onDisconnect = vi.fn();
    const jwt = { verifyAsync: vi.fn().mockRejectedValue(new Error('expired')) };
    await expect(ensureSocketJwtValid(c, jwt as never, onDisconnect)).resolves.toBe(false);
    expect(onDisconnect).toHaveBeenCalledWith('42');
    expect(c.disconnect).toHaveBeenCalled();
    process.env.JWT_ACCESS_SECRET = prev;
  });
});