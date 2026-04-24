import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validate } from "../../middlewares/validate";
import { executionParamsSchema, createExecutionSchema, updateExecutionSchema } from "./executions.schemas";
import { listHandler, detailHandler, createHandler, updateHandler, deleteHandler } from "./executions.controller";

const router = Router();

router.use(authenticate);

router.get("/", listHandler);
router.get("/:id", validate(executionParamsSchema, "params"), detailHandler);
router.post("/", validate(createExecutionSchema), createHandler);
router.put("/:id", validate(executionParamsSchema, "params"), validate(updateExecutionSchema), updateHandler);
router.delete("/:id", validate(executionParamsSchema, "params"), deleteHandler);

export { router as executionsRouter };
