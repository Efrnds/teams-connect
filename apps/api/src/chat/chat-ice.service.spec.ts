import { describe, expect, it, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ChatIceService } from './chat-ice.service.js';

describe('ChatIceService', () => {
  it('rejeita ICE sem Authorization', async () => {
    const jwt = { verifyAsync: vi.fn() } as unknown as JwtService;
    const svc = new ChatIceService(jwt);
    await expect(svc.getIceServersForToken(undefined)).rejects.toThrow();
  });

  it('aplica rate limit após várias requisições', async () => {
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    const jwt = {
      verifyAsync: vi.fn().mockResolvedValue({ sub: '1' }),
    } as unknown as JwtService;
    const svc = new ChatIceService(jwt);
    const auth = 'Bearer fake';
    for (let i = 0; i < 6; i++) {
      await svc.getIceServersForToken(auth);
    }
    await expect(svc.getIceServersForToken(auth)).rejects.toThrow();
  });
});