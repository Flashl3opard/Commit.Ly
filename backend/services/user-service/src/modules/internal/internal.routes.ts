import { Router } from "express";
import { linkGithub, unlinkGithub, getGithubIdentity } from "./internal.controller";
import { internalServiceMiddleware } from "../../middleware/internalServiceMiddleware";

const router = Router();

router.use(internalServiceMiddleware);

router.get("/users/:id/github", getGithubIdentity);
router.patch("/users/:id/github", linkGithub);
router.delete("/users/:id/github", unlinkGithub);

export default router;
