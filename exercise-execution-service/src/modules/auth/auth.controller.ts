import { Request, Response, NextFunction } from "express";
import * as authService from "./auth.service";
import { RegisterInput, LoginInput } from "./auth.schemas";

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.register(req.body as RegisterInput);
    res.status(201).location(`/me`).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await authService.login(req.body as LoginInput);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
