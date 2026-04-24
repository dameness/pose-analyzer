import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  const rounds = 10

  const [alice, bob] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: {
        email: 'alice@example.com',
        password: await bcrypt.hash('senha123', rounds),
        name: 'Alice',
      },
    }),
    prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: {
        email: 'bob@example.com',
        password: await bcrypt.hash('senha123', rounds),
        name: 'Bob',
      },
    }),
  ])

  const [squat, pushup, situp] = await Promise.all([
    prisma.exercise.upsert({
      where: { slug: 'squat' },
      update: {},
      create: {
        slug: 'squat',
        name: 'Agachamento',
        description:
          'Fique em pé com os pés na largura dos ombros. Dobre os joelhos abaixando o quadril até as coxas ficarem paralelas ao chão, mantendo o tronco ereto e os joelhos alinhados com os pés. Retorne à posição inicial.',
      },
    }),
    prisma.exercise.upsert({
      where: { slug: 'pushup' },
      update: {},
      create: {
        slug: 'pushup',
        name: 'Flexão',
        description:
          'Apoie as mãos no chão na largura dos ombros e os pés juntos, mantendo o corpo reto. Dobre os cotovelos abaixando o peito até próximo ao chão, depois empurre de volta à posição inicial sem deixar o quadril afundar.',
      },
    }),
    prisma.exercise.upsert({
      where: { slug: 'situp' },
      update: {},
      create: {
        slug: 'situp',
        name: 'Abdominal',
        description:
          'Deite de costas com joelhos dobrados e pés apoiados no chão. Com as mãos atrás da cabeça, contraia o abdômen elevando o tronco em direção aos joelhos e retorne lentamente ao chão.',
      },
    }),
  ])

  const executions = [
    { userId: alice.id, exerciseId: squat.id, reps: 15, durationSec: 45, result: 'correct', score: 0.92, executedAt: new Date('2026-04-10T08:00:00Z') },
    { userId: alice.id, exerciseId: pushup.id, reps: 10, durationSec: 40, result: 'correct', score: 0.88, executedAt: new Date('2026-04-10T08:05:00Z') },
    { userId: alice.id, exerciseId: situp.id, reps: 20, durationSec: 60, result: 'incorrect', score: 0.45, executedAt: new Date('2026-04-11T09:00:00Z') },
    { userId: alice.id, exerciseId: squat.id, reps: 12, durationSec: 38, result: 'correct', score: 0.95, executedAt: new Date('2026-04-12T07:30:00Z') },
    { userId: alice.id, exerciseId: pushup.id, reps: 8, durationSec: 35, result: 'incorrect', score: 0.51, executedAt: new Date('2026-04-14T18:00:00Z') },
    { userId: alice.id, exerciseId: situp.id, reps: 25, durationSec: 70, result: 'correct', score: 0.83, executedAt: new Date('2026-04-15T07:00:00Z') },
    { userId: bob.id, exerciseId: squat.id, reps: 20, durationSec: 55, result: 'correct', score: 0.91, executedAt: new Date('2026-04-11T10:00:00Z') },
    { userId: bob.id, exerciseId: situp.id, reps: 15, durationSec: 50, result: 'incorrect', score: 0.38, executedAt: new Date('2026-04-13T17:30:00Z') },
    { userId: bob.id, exerciseId: pushup.id, reps: 12, durationSec: 42, result: 'correct', score: 0.79, executedAt: new Date('2026-04-16T06:45:00Z') },
    { userId: bob.id, exerciseId: squat.id, reps: 18, durationSec: 52, result: 'correct', score: 0.87, executedAt: new Date('2026-04-18T08:15:00Z') },
  ]

  await prisma.exerciseExecution.deleteMany()
  await prisma.exerciseExecution.createMany({ data: executions })

  console.log(`Seed concluído:`)
  console.log(`  Usuários: alice (id=${alice.id}), bob (id=${bob.id})`)
  console.log(`  Exercícios: squat (${squat.id}), pushup (${pushup.id}), situp (${situp.id})`)
  console.log(`  Execuções: ${executions.length}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
