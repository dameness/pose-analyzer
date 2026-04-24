import { prisma } from "../../lib/prisma";

export async function findAll() {
  return prisma.exercise.findMany({ orderBy: { id: "asc" } });
}

export async function findById(id: number) {
  return prisma.exercise.findUnique({ where: { id } });
}
