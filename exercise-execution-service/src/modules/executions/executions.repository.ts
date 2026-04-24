import { prisma } from "../../lib/prisma";
import { CreateExecutionInput, UpdateExecutionInput } from "./executions.schemas";

export async function findAllByUser(userId: number) {
  return prisma.exerciseExecution.findMany({
    where: { userId },
    include: { exercise: true },
    orderBy: { executedAt: "desc" },
  });
}

export async function findByIdAndUser(id: number, userId: number) {
  return prisma.exerciseExecution.findFirst({
    where: { id, userId },
    include: { exercise: true },
  });
}

export async function create(userId: number, data: CreateExecutionInput) {
  return prisma.exerciseExecution.create({
    data: { userId, ...data },
    include: { exercise: true },
  });
}

export async function update(id: number, userId: number, data: UpdateExecutionInput) {
  return prisma.exerciseExecution.updateMany({
    where: { id, userId },
    data,
  });
}

export async function findById(id: number) {
  return prisma.exerciseExecution.findUnique({
    where: { id },
    include: { exercise: true },
  });
}

export async function remove(id: number, userId: number) {
  return prisma.exerciseExecution.deleteMany({
    where: { id, userId },
  });
}
