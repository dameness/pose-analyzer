import * as exercisesRepository from "./exercises.repository";
import { NotFoundError } from "../../errors/AppError";

export async function listExercises() {
  return exercisesRepository.findAll();
}

export async function getExercise(id: number) {
  const exercise = await exercisesRepository.findById(id);
  if (!exercise) throw new NotFoundError("Exercise not found");
  return exercise;
}
