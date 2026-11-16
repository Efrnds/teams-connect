import { Injectable, TooManyRequestsException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CallSignalingRateLimit } from './call-signaling-limits.js';
import { buildEphemeralTurnCredentials } from './ice-turn-credentials.js';
import { resolveTurnCredential } from './ice-turn-policy.js';

type IceServerDto = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function parseUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

@Injectable()
export class ChatIceService {
  private readonly fetchLimit = new CallSignalingRateLimit();

  constructor(private readonly jwt: JwtService) {}

  async getIceServersForToken(
    authorization?: string,
  ): Promise<{ iceServers: IceServerDto[]; expiresAt?: number }> {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException();
    }
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new UnauthorizedException();
    }
    const payload = await this.jwt.verifyAsync<{ sub: string }>(token, { secret });
    const userId = payload.sub;
    if (!this.fetchLimit.allowIceFetch(userId)) {
      throw new TooManyRequestsException('Limite de requisições ICE excedido.');
    }

    const iceServers: IceServerDto[] = [];
    const stunUrls = parseUrls(process.env.ICE_STUN_URLS);
    if (stunUrls.length) {
      iceServers.push({ urls: stunUrls });
    } else {
      iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
    }

    const turnUrls = parseUrls(process.env.ICE_TURN_URLS);
    if (!turnUrls.length) {
      return { iceServers };
    }

    const ttl = Number(process.env.ICE_TURN_CREDENTIAL_TTL_SEC ?? 3600);
    const turn = resolveTurnCredential(
      userId,
      {
        nodeEnv: process.env.NODE_ENV,
        turnRestSecret: process.env.ICE_TURN_REST_SECRET,
        turnUsername: process.env.ICE_TURN_USERNAME,
        turnCredential: process.env.ICE_TURN_CREDENTIAL,
      },
      buildEphemeralTurnCredentials,
      ttl,
    );

    if (turn.kind === 'ephemeral' || turn.kind === 'static_dev') {
      iceServers.push({
        urls: turnUrls,
        username: turn.username,
        credential: turn.credential,
      });
      if (turn.kind === 'ephemeral') {
        return { iceServers, expiresAt: turn.expiresAt };
      }
    }

    return { iceServers };
  }
}