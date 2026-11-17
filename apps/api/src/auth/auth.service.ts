import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ChannelsService } from '../channels/channels.service.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(ChannelsService) private readonly channels: ChannelsService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });
    await this.channels.ensureDefaultChannelsForUser(user.id);
    return this.issueTokens(user.id, user.email, user.name ?? dto.name);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    await this.channels.ensureDefaultChannelsForUser(user.id);
    return this.issueTokens(user.id, user.email, user.name ?? user.email);
  }

  async me(userId: string) {
    const user = await this.users.findById(BigInt(userId));
    if (!user) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
    };
  }

  private async issueTokens(userId: bigint, email: string, name: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId.toString(), email },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: '7d',
      },
    );
    return {
      accessToken,
      user: { id: userId.toString(), email, name },
    };
  }
}
