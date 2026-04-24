import { Request, Response, NextFunction } from "express";
import * as usersService from "./users.service";

export async function meHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getMe(req.user!.id);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
