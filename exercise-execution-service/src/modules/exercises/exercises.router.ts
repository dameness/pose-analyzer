import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { exerciseParamsSchema } from "./exercises.schemas";
import { listHandler, detailHandler } from "./exercises.controller";

const router = Router();

router.get("/", listHandler);
router.get("/:id", validate(exerciseParamsSchema, "params"), detailHandler);

export { router as exercisesRouter };
