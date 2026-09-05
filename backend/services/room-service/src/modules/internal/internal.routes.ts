import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { getMembership } from "./internal.controller";
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

const router = Router();

router.use(internalServiceMiddleware);

router.get("/rooms/:roomId/members/:userId", validateMembershipParams, getMembership);

export default router;
