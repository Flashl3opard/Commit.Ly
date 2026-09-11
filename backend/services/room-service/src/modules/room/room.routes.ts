import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { create, join, listMine, listShared, getDetails, leave, remove } from "./room.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const roomIdParamSchema = z.object({ roomId: z.string().uuid() });

function validateRoomIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = roomIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id." });
  }
  return next();
}

const userIdParamSchema = z.object({ userId: z.string().uuid() });

function validateUserIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = userIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid user id." });
  }
  return next();
}

const router = Router();

router.post("/", authMiddleware, create);
router.post("/join", authMiddleware, join);
router.get("/", authMiddleware, listMine);
// Mounted before /:roomId so its literal "shared-with" segment is never
// swallowed by the generic single-segment room id matcher below.
router.get("/shared-with/:userId", authMiddleware, validateUserIdParam, listShared);
router.get("/:roomId", authMiddleware, validateRoomIdParam, getDetails);
router.post("/:roomId/leave", authMiddleware, validateRoomIdParam, leave);
router.delete("/:roomId", authMiddleware, validateRoomIdParam, remove);

export default router;
