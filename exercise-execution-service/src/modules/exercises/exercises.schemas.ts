import { z } from "zod";

export const exerciseParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
