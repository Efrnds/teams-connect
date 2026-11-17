import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  MemberRole,
  PrismaClient,
  Type,
} from '../src/generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const DEFAULTS = [
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

async function main() {
  const passwordHash = await bcrypt.hash('texsa123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@texsa.local' },
    update: {},
    create: {
      email: 'admin@texsa.local',
      name: 'Admin Texsa',
      passwordHash,
    },
  });

  const mateus = await prisma.user.upsert({
    where: { email: 'mateus@texsa.local' },
    update: {},
    create: {
      email: 'mateus@texsa.local',
      name: 'Mateus',
      passwordHash,
    },
  });

  const users = [admin, mateus];

  for (const def of DEFAULTS) {
    const channel = await prisma.channel.upsert({
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

    for (const user of users) {
      await prisma.channelMember.upsert({
        where: {
          channelId_userId: { channelId: channel.id, userId: user.id },
        },
        update: {},
        create: {
          channelId: channel.id,
          userId: user.id,
          role: MemberRole.MEMBER,
        },
      });
    }

    if (def.slug === 'geral') {
      const count = await prisma.message.count({
        where: { channelId: channel.id },
      });
      if (count === 0) {
        await prisma.message.create({
          data: {
            channelId: channel.id,
            authorId: admin.id,
            body: 'Bem-vindos ao Texsa Chat. Canal #geral no ar.',
          },
        });
      }
    }
  }

  console.log('Seed OK: admin@texsa.local / texsa123 (+ #geral, #avisos)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
