import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { meHandler } from "./users.controller";

const router = Router();

router.get("/me", authenticate, meHandler);

export { router as usersRouter };
