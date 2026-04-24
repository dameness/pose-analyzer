import { Request, Response, NextFunction } from "express";
import * as exercisesService from "./exercises.service";

export async function listHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const exercises = await exercisesService.listExercises();
    res.json({ exercises });
  } catch (err) {
    next(err);
  }
}

export async function detailHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const exercise = await exercisesService.getExercise(Number(req.params.id));
    res.json({ exercise });
  } catch (err) {
    next(err);
  }
}
