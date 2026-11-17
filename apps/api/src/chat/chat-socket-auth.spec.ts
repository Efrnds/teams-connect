import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSocketJwtValid, type AuthedSocket } from './chat-socket-auth.js';

describe('ensureSocketJwtValid', () => {
  const secret = 'test-secret';

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = secret;
  });

  it('rejeita socket sem token', async () => {
    const client = {
      userId: '1',
      disconnect: vi.fn(),
    } as unknown as AuthedSocket;
    const jwt = { verifyAsync: vi.fn() };
    expect(await ensureSocketJwtValid(client, jwt as never)).toBe(false);
    expect(client.disconnect).toHaveBeenCalled();
  });

  it('aceita quando verify bate com userId', async () => {
    const client = {
      userId: '1',
      authToken: 'tok',
      disconnect: vi.fn(),
    } as unknown as AuthedSocket;
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ sub: '1' }),
    };
    expect(await ensureSocketJwtValid(client, jwt as never)).toBe(true);
  });

  it('derruba socket quando JWT expirou', async () => {
    const onDisconnect = vi.fn();
    const client = {
      userId: '1',
      authToken: 'tok',
      disconnect: vi.fn(),
    } as unknown as AuthedSocket;
    const jwt = {
      verifyAsync: vi.fn().mockRejectedValue(new Error('expired')),
    };
    expect(await ensureSocketJwtValid(client, jwt as never, onDisconnect)).toBe(false);
    expect(onDisconnect).toHaveBeenCalledWith('1');
    expect(client.disconnect).toHaveBeenCalled();
  });
});