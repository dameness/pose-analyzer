import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { Prisma } from "@prisma/client";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        ...(err.details !== undefined && { details: err.details }),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: { message: "Resource already exists", code: "CONFLICT" } });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: { message: "Resource not found", code: "NOT_FOUND" } });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: { message: "Internal server error", code: "INTERNAL_ERROR" } });
}
