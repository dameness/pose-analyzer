import { prisma } from "../../lib/prisma";

export async function findById(id: number) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}
