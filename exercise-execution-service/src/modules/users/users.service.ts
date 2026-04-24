import * as usersRepository from "./users.repository";
import { NotFoundError } from "../../errors/AppError";

export async function getMe(userId: number) {
  const user = await usersRepository.findById(userId);
  if (!user) throw new NotFoundError("User not found");
  return user;
}
