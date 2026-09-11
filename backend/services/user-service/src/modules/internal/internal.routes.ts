import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { linkGithub, unlinkGithub, getGithubIdentity, getFriendshipStatus } from "./internal.controller";
import { internalServiceMiddleware } from "../../middleware/internalServiceMiddleware";

const friendshipParamsSchema = z.object({
  userAId: z.string().uuid(),
  userBId: z.string().uuid(),
});

function validateFriendshipParams(req: Request, res: Response, next: NextFunction) {
  const parsed = friendshipParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid user ids." });
  }
  return next();
}

const router = Router();

router.use(internalServiceMiddleware);

router.get("/users/:id/github", getGithubIdentity);
router.patch("/users/:id/github", linkGithub);
router.delete("/users/:id/github", unlinkGithub);
router.get("/users/:userAId/friends/:userBId/status", validateFriendshipParams, getFriendshipStatus);

export default router;
