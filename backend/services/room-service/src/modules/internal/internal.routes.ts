import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { getMembership, getRoomByGithubRepository } from "./internal.controller";
import { internalServiceMiddleware } from "../../middleware/internalServiceMiddleware";

const membershipParamsSchema = z.object({
  roomId: z.string().uuid(),
  userId: z.string().uuid(),
});

function validateMembershipParams(req: Request, res: Response, next: NextFunction) {
  const parsed = membershipParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id or user id." });
  }
  return next();
}

const githubRepositoryParamSchema = z.object({
  githubRepositoryId: z.string().regex(/^\d+$/, "githubRepositoryId must be numeric"),
});

function validateGithubRepositoryParam(req: Request, res: Response, next: NextFunction) {
  const parsed = githubRepositoryParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid GitHub repository id." });
  }
  return next();
}

const router = Router();

router.use(internalServiceMiddleware);

router.get("/rooms/:roomId/members/:userId", validateMembershipParams, getMembership);
router.get(
  "/rooms/by-github-repository/:githubRepositoryId",
  validateGithubRepositoryParam,
  getRoomByGithubRepository,
);

export default router;
