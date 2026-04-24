import * as executionsRepository from "./executions.repository";
import { exercisesRepository } from "../exercises";
import { NotFoundError } from "../../errors/AppError";
import { CreateExecutionInput, UpdateExecutionInput } from "./executions.schemas";

export async function listExecutions(userId: number) {
  return executionsRepository.findAllByUser(userId);
}

export async function getExecution(id: number, userId: number) {
  const execution = await executionsRepository.findByIdAndUser(id, userId);
  if (!execution) throw new NotFoundError("Execution not found");
  return execution;
}

export async function createExecution(userId: number, data: CreateExecutionInput) {
  const exercise = await exercisesRepository.findById(data.exerciseId);
  if (!exercise) throw new NotFoundError("Exercise not found");

  return executionsRepository.create(userId, data);
}

export async function updateExecution(id: number, userId: number, data: UpdateExecutionInput) {
  const existing = await executionsRepository.findByIdAndUser(id, userId);
  if (!existing) throw new NotFoundError("Execution not found");

  await executionsRepository.update(id, userId, data);
  return executionsRepository.findById(id);
}

export async function deleteExecution(id: number, userId: number) {
  const existing = await executionsRepository.findByIdAndUser(id, userId);
  if (!existing) throw new NotFoundError("Execution not found");

  await executionsRepository.remove(id, userId);
}
