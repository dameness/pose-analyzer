import { z } from "zod";

export const executionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createExecutionSchema = z.object({
  exerciseId: z.number().int().positive(),
  reps: z.number().int().positive(),
  durationSec: z.number().int().positive(),
  result: z.enum(["correct", "incorrect"]),
  score: z.number().min(0).max(1),
  executedAt: z.coerce.date(),
});

export const updateExecutionSchema = z.object({
  reps: z.number().int().positive().optional(),
  durationSec: z.number().int().positive().optional(),
  result: z.enum(["correct", "incorrect"]).optional(),
  score: z.number().min(0).max(1).optional(),
  executedAt: z.coerce.date().optional(),
});

export type CreateExecutionInput = z.infer<typeof createExecutionSchema>;
export type UpdateExecutionInput = z.infer<typeof updateExecutionSchema>;
