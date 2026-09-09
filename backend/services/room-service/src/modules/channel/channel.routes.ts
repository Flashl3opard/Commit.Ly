import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { list, create, update, remove } from "./channel.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const roomIdParamSchema = z.object({ roomId: z.string().uuid() });
const roomAndChannelIdParamsSchema = z.object({
  roomId: z.string().uuid(),
  channelId: z.string().uuid(),
});

function validateRoomIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = roomIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id." });
  }
  return next();
}

function validateRoomAndChannelIdParams(req: Request, res: Response, next: NextFunction) {
  const parsed = roomAndChannelIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id or channel id." });
  }
  return next();
}

// Mounted at /rooms/:roomId/channels
const router = Router({ mergeParams: true });

router.get("/", authMiddleware, validateRoomIdParam, list);
router.post("/", authMiddleware, validateRoomIdParam, create);
router.patch("/:channelId", authMiddleware, validateRoomAndChannelIdParams, update);
router.delete("/:channelId", authMiddleware, validateRoomAndChannelIdParams, remove);

export default router;
