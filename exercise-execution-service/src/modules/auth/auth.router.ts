import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { registerSchema, loginSchema } from "./auth.schemas";
import { registerHandler, loginHandler } from "./auth.controller";

const router = Router();

router.post("/register", validate(registerSchema), registerHandler);
router.post("/login", validate(loginSchema), loginHandler);

export { router as authRouter };
