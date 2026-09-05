import { Router } from "express";
import { getRepositoryById } from "./internal.controller";
import { internalServiceMiddleware } from "../../middleware/internalServiceMiddleware";

const router = Router();

router.use(internalServiceMiddleware);

router.get("/github/repositories/:id", getRepositoryById);

export default router;
