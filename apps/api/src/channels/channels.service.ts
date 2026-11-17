import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, Type } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  AddMemberDto,
  CreateChannelDto,
  CreateDmDto,
} from './dto/create-channel.dto.js';

const DEFAULT_CHANNELS = [
  {
    slug: 'geral',
    name: 'geral',
    description: 'Canal principal da Texsa',
  },
  {
    slug: 'avisos',
    name: 'avisos',
    description: 'Comunicados oficiais da Texsa',
  },
] as const;

@Injectable()
export class ChannelsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private slugify(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);
  }

  private mapChannel(
    channel: {
      id: bigint;
      name: string | null;
      slug: string;
      type: Type;
      description: string | null;
      isDefault: boolean;
    },
    extras?: {
      members?: Array<{
        user: { id: bigint; name: string | null; email: string };
      }>;
    },
  ) {
    return {
      id: channel.id.toString(),
      name: channel.name,
      slug: channel.slug,
      type: channel.type,
      description: channel.description,
      isDefault: channel.isDefault,
      members: extras?.members?.map((m) => ({
        id: m.user.id.toString(),
        name: m.user.name,
        email: m.user.email,
      })),
    };
  }

  /** Canais globais: todo user novo entra neles. */
  async ensureDefaultChannelsForUser(userId: bigint) {
    for (const def of DEFAULT_CHANNELS) {
      const channel = await this.prisma.channel.upsert({
        where: { slug: def.slug },
        update: {
          isDefault: true,
          type: Type.PUBLIC,
          description: def.description,
        },
        create: {
          name: def.name,
          slug: def.slug,
          type: Type.PUBLIC,
          isDefault: true,
          description: def.description,
        },
      });
      await this.prisma.channelMember.upsert({
        where: {
          channelId_userId: { channelId: channel.id, userId },
        },
        update: {},
        create: {
          channelId: channel.id,
          userId,
          role: MemberRole.MEMBER,
        },
      });
    }
  }

  /** @deprecated use ensureDefaultChannelsForUser */
  async ensureGeralForUser(userId: bigint) {
    return this.ensureDefaultChannelsForUser(userId);
  }

  async listForUser(userId: bigint) {
    await this.ensureDefaultChannelsForUser(userId);
    const memberships = await this.prisma.channelMember.findMany({
      where: { userId },
      include: {
        channel: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => {
      const channel = m.channel;
      let displayName = channel.name;
      if (channel.type === Type.DM) {
        const other = channel.members.find((mem) => mem.userId !== userId);
        displayName = other?.user.name || other?.user.email || 'DM';
      }
      return {
        ...this.mapChannel(
          { ...channel, name: displayName },
          { members: channel.members },
        ),
      };
    });
  }

  async create(userId: bigint, dto: CreateChannelDto) {
    const type = dto.type ?? Type.PUBLIC;
    if (type === Type.DM) {
      throw new BadRequestException('Use POST /channels/dm para DMs');
    }

    const base = this.slugify(dto.name) || 'canal';
    if (DEFAULT_CHANNELS.some((d) => d.slug === base)) {
      throw new BadRequestException(
        `Slug "${base}" é reservado para canais globais`,
      );
    }

    const memberIds = new Set(
      (dto.memberIds ?? [])
        .map((id) => {
          try {
            return BigInt(id);
          } catch {
            return null;
          }
        })
        .filter((id): id is bigint => id !== null && id !== userId),
    );

    if (type === Type.PRIVATE && memberIds.size === 0) {
      // privado só com o criador é ok; convidados opcionais
    }

    for (const id of memberIds) {
      const exists = await this.prisma.user.findUnique({ where: { id } });
      if (!exists) {
        throw new NotFoundException(`User ${id} not found`);
      }
    }

    const slug = `${base}-${Date.now().toString(36)}`;
    const channel = await this.prisma.channel.create({
      data: {
        name: dto.name,
        slug,
        description: dto.description,
        type,
        isDefault: false,
        members: {
          create: [
            { userId, role: MemberRole.OWNER },
            ...Array.from(memberIds).map((id) => ({
              userId: id,
              role: MemberRole.MEMBER,
            })),
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return this.mapChannel(channel, { members: channel.members });
  }

  async createDm(userId: bigint, dto: CreateDmDto) {
    let otherUserId: bigint;
    try {
      otherUserId = BigInt(dto.otherUserId);
    } catch {
      throw new BadRequestException('otherUserId inválido');
    }
    if (otherUserId === userId) {
      throw new BadRequestException('Não dá pra abrir DM consigo mesmo');
    }

    const other = await this.prisma.user.findUnique({
      where: { id: otherUserId },
    });
    if (!other) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const existing = await this.prisma.channel.findFirst({
      where: {
        type: Type.DM,
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: otherUserId } } },
        ],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (existing) {
      return this.mapChannel(
        {
          ...existing,
          name: other.name || other.email,
        },
        { members: existing.members },
      );
    }

    const ids = [userId, otherUserId].sort((a, b) => (a < b ? -1 : 1));
    const slug = `dm-${ids[0]}-${ids[1]}`;
    const channel = await this.prisma.channel.create({
      data: {
        name: other.name || other.email,
        slug,
        type: Type.DM,
        isDefault: false,
        description: null,
        members: {
          create: [
            { userId, role: MemberRole.MEMBER },
            { userId: otherUserId, role: MemberRole.MEMBER },
          ],
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    return this.mapChannel(
      { ...channel, name: other.name || other.email },
      { members: channel.members },
    );
  }

  async joinPublic(channelId: bigint, userId: bigint) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.type !== Type.PUBLIC) {
      throw new ForbiddenException('Só canais públicos aceitam join livre');
    }
    await this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId } },
      update: {},
      create: { channelId, userId, role: MemberRole.MEMBER },
    });
    return this.getById(channelId, userId);
  }

  async addMember(channelId: bigint, actorId: bigint, dto: AddMemberDto) {
    const membership = await this.prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: actorId } },
    });
    if (!membership || membership.role !== MemberRole.OWNER) {
      throw new ForbiddenException('Só o dono do canal pode adicionar membros');
    }

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.type === Type.DM) {
      throw new BadRequestException('DM não aceita novos membros');
    }
    if (channel.isDefault) {
      throw new BadRequestException(
        'Canais globais já incluem todos automaticamente',
      );
    }

    let targetId: bigint;
    try {
      targetId = BigInt(dto.userId);
    } catch {
      throw new BadRequestException('userId inválido');
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
    });
    if (!target) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.prisma.channelMember.upsert({
      where: { channelId_userId: { channelId, userId: targetId } },
      update: {},
      create: {
        channelId,
        userId: targetId,
        role: MemberRole.MEMBER,
      },
    });
    return this.getById(channelId, actorId);
  }

  async assertMember(channelId: bigint, userId: bigint) {
    const membership = await this.prisma.channelMember.findUnique({
      where: {
        channelId_userId: { channelId, userId },
      },
    });
    if (!membership) {
      throw new ForbiddenException('Not a channel member');
    }
    return membership;
  }

  async getById(channelId: bigint, userId: bigint) {
    await this.assertMember(channelId, userId);
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    let displayName = channel.name;
    if (channel.type === Type.DM) {
      const other = channel.members.find((m) => m.userId !== userId);
      displayName = other?.user.name || other?.user.email || 'DM';
    }
    return this.mapChannel(
      { ...channel, name: displayName },
      { members: channel.members },
    );
  }
}
