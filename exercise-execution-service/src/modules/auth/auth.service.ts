import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { ConflictError, UnauthorizedError } from "../../errors/AppError";
import { RegisterInput, LoginInput } from "./auth.schemas";

export async function register(data: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) throw new ConflictError("Email already in use");

  const hashed = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email: data.email, password: hashed, name: data.name },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return user;
}

export async function login(data: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) throw new UnauthorizedError("Invalid credentials");

  const match = await bcrypt.compare(data.password, user.password);
  if (!match) throw new UnauthorizedError("Invalid credentials");

  const token = jwt.sign({ sub: user.id }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
  };
}
