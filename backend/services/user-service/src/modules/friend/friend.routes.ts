import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import {
  searchUsers,
  createFriendRequest,
  respondToRequest,
  listRequests,
  listMyFriends,
  deleteFriend,
} from "./friend.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const requestIdParamSchema = z.object({ requestId: z.string().uuid() });

function validateRequestIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = requestIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid friend request id." });
  }
  return next();
}

const friendUserIdParamSchema = z.object({ userId: z.string().uuid() });

function validateFriendUserIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = friendUserIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid user id." });
  }
  return next();
}

const router = Router();

router.get("/search", authMiddleware, searchUsers);
router.get("/friends", authMiddleware, listMyFriends);
router.delete("/friends/:userId", authMiddleware, validateFriendUserIdParam, deleteFriend);
router.get("/friend-requests", authMiddleware, listRequests);
router.post("/friend-requests", authMiddleware, createFriendRequest);
router.patch("/friend-requests/:requestId", authMiddleware, validateRequestIdParam, respondToRequest);

export default router;
