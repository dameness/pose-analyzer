import * as path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import * as bcrypt from 'bcrypt';

function resolverUrlBanco(databaseUrl: string): string {
  if (databaseUrl.startsWith('file:./') || databaseUrl.startsWith('file:../')) {
    const caminho = databaseUrl.replace(/^file:/, '');
    const caminhoAbsoluto = path.resolve(process.cwd(), caminho);
    return `file://${caminhoAbsoluto}`;
  }
  return databaseUrl;
}

const urlBanco = resolverUrlBanco(
  process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
);
const adapter = new PrismaLibSql({ url: urlBanco });
const prisma = new PrismaClient({ adapter } as any);

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
