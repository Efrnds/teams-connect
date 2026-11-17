import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

export type AuthedSocket = Socket & {
  userId?: string;
  authToken?: string;
};

/** Revalida JWT a cada evento de chamada (token expirado/revogado derruba o socket). */
export async function ensureSocketJwtValid(
  client: AuthedSocket,
  jwt: JwtService,
  onDisconnect?: (userId: string) => void,
): Promise<boolean> {
  const userId = client.userId;
  const token = client.authToken;
  if (!userId || !token) {
    client.disconnect();
    return false;
  }
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    client.disconnect();
    return false;
  }
  try {
    const payload = await jwt.verifyAsync<{ sub: string }>(token, { secret });
    if (payload.sub !== userId) {
      client.disconnect();
      return false;
    }
    return true;
  } catch {
    onDisconnect?.(userId);
    client.disconnect();
    return false;
  }
}