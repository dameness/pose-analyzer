import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.exercise.upsert({
    where: { slug: 'squat' },
    update: {},
    create: {
      slug: 'squat',
      name: 'Agachamento',
      description: 'Exercício de agachamento livre.',
    },
  });
  await prisma.exercise.upsert({
    where: { slug: 'pushup' },
    update: {},
    create: {
      slug: 'pushup',
      name: 'Flexão',
      description: 'Flexão de braço no solo.',
    },
  });
  await prisma.exercise.upsert({
    where: { slug: 'situp' },
    update: {},
    create: {
      slug: 'situp',
      name: 'Abdominal',
      description: 'Abdominal clássico (sit-up).',
    },
  });

  const hash = await bcrypt.hash('senha123', 10);
  await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', password: hash, name: 'Alice' },
  });
  await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', password: hash, name: 'Bob' },
  });

  console.log('Seed completo.');
}

main().finally(() => prisma.$disconnect());
