import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { create, history } from "./message.controller";
import { search } from "./messageSearch.controller";
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
roomMessagesRouter.get("/search", authMiddleware, validateRoomIdParam, search);
roomMessagesRouter.get("/", authMiddleware, validateRoomIdParam, history);

export { roomMessagesRouter };
