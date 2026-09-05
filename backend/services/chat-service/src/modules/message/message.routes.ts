import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { create } from "./message.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const roomIdParamSchema = z.object({ roomId: z.string().uuid() });

function validateRoomIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = roomIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id." });
  }
  return next();
}

// Mounted at /rooms/:roomId/messages
const roomMessagesRouter = Router({ mergeParams: true });
roomMessagesRouter.post("/", authMiddleware, validateRoomIdParam, create);

export { roomMessagesRouter };
