import { createHmac } from 'node:crypto';

/** Credenciais efêmeras estilo TURN REST (coturn `use-auth-secret`). */
export function buildEphemeralTurnCredentials(
  userId: string,
  restSecret: string,
  ttlSeconds = 3600,
): { username: string; credential: string; expiresAt: number } {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const username = `${expiresAt}:${userId}`;
  const credential = createHmac('sha1', restSecret).update(username).digest('base64');
  return { username, credential, expiresAt };
}