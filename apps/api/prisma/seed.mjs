import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Type } from '../generated/prisma/client.js';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

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

  const geral = await prisma.channel.upsert({
    where: { slug: 'geral' },
    update: {},
    create: {
      name: 'geral',
      slug: 'geral',
      type: Type.PUBLIC,
      description: 'Canal principal da Texsa',
    },
  });

  for (const user of [admin, mateus]) {
    await prisma.channelMember.upsert({
      where: {
        channelId_userId: { channelId: geral.id, userId: user.id },
      },
      update: {},
      create: { channelId: geral.id, userId: user.id },
    });
  }

  const count = await prisma.message.count({ where: { channelId: geral.id } });
  if (count === 0) {
    await prisma.message.create({
      data: {
        channelId: geral.id,
        authorId: admin.id,
        body: 'Bem-vindos ao Texsa Chat. Canal #geral no ar.',
      },
    });
  }

  console.log('Seed OK: admin@texsa.local / texsa123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
