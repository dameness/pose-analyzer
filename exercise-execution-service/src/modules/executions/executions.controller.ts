import { Request, Response, NextFunction } from "express";
import * as executionsService from "./executions.service";
import { CreateExecutionInput, UpdateExecutionInput } from "./executions.schemas";

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const executions = await executionsService.listExecutions(req.user!.id);
    res.json({ executions });
  } catch (err) {
    next(err);
  }
}

export async function detailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const execution = await executionsService.getExecution(Number(req.params.id), req.user!.id);
    res.json({ execution });
  } catch (err) {
    next(err);
  }
}

export async function createHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const execution = await executionsService.createExecution(
      req.user!.id,
      req.body as CreateExecutionInput
    );
    res.status(201).location(`/executions/${execution.id}`).json({ execution });
  } catch (err) {
    next(err);
  }
}

export async function updateHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const execution = await executionsService.updateExecution(
      Number(req.params.id),
      req.user!.id,
      req.body as UpdateExecutionInput
    );
    res.json({ execution });
  } catch (err) {
    next(err);
  }
}

export async function deleteHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await executionsService.deleteExecution(Number(req.params.id), req.user!.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
