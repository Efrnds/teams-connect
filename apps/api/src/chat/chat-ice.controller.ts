import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

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

@Controller('chat')
export class ChatIceController {
  constructor(private readonly jwt: JwtService) {}

  @Get('ice-servers')
  async iceServers(@Headers('authorization') authorization?: string): Promise<{ iceServers: IceServerDto[] }> {
    const token = authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      throw new UnauthorizedException();
    }
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new UnauthorizedException();
    }
    await this.jwt.verifyAsync<{ sub: string }>(token, { secret });

    const iceServers: IceServerDto[] = [];
    const stunUrls = parseUrls(process.env.ICE_STUN_URLS);
    if (stunUrls.length) {
      iceServers.push({ urls: stunUrls });
    } else {
      iceServers.push({ urls: 'stun:stun.l.google.com:19302' });
    }

    const turnUrls = parseUrls(process.env.ICE_TURN_URLS);
    const turnUser = process.env.ICE_TURN_USERNAME;
    const turnCred = process.env.ICE_TURN_CREDENTIAL;
    if (turnUrls.length && turnUser && turnCred) {
      iceServers.push({
        urls: turnUrls,
        username: turnUser,
        credential: turnCred,
      });
    }

    return { iceServers };
  }
}