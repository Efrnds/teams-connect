import { Inject, Injectable } from '@nestjs/common';
import { ChannelsService } from '../channels/channels.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';

@Injectable()
export class MessagesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ChannelsService) private readonly channels: ChannelsService,
  ) {}

  private mapMessage(message: {
    id: bigint;
    channelId: bigint;
    body: string;
    createdAt: Date;
    author: { id: bigint; name: string | null; email: string };
  }) {
    return {
      id: message.id.toString(),
      channelId: message.channelId.toString(),
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      author: {
        id: message.author.id.toString(),
        name: message.author.name,
        email: message.author.email,
      },
    };
  }

  async list(channelId: bigint, userId: bigint) {
    await this.channels.assertMember(channelId, userId);
    const messages = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
    return messages.map((m) => this.mapMessage(m));
  }

  async create(channelId: bigint, userId: bigint, dto: CreateMessageDto) {
    await this.channels.assertMember(channelId, userId);
    const message = await this.prisma.message.create({
      data: {
        channelId,
        authorId: userId,
        body: dto.body,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
    return this.mapMessage(message);
  }
}
