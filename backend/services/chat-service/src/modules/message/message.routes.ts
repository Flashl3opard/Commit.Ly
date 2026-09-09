import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { create, history, createThreadReply, listThreadReplies } from "./message.controller";
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

const roomAndChannelIdParamsSchema = z.object({
  roomId: z.string().uuid(),
  channelId: z.string().uuid(),
});

function validateRoomAndChannelIdParams(req: Request, res: Response, next: NextFunction) {
  const parsed = roomAndChannelIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id or channel id." });
  }
  return next();
}

const roomAndMessageIdParamsSchema = z.object({
  roomId: z.string().uuid(),
  messageId: z.string().uuid(),
});

function validateRoomAndMessageIdParams(req: Request, res: Response, next: NextFunction) {
  const parsed = roomAndMessageIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid room id or message id." });
  }
  return next();
}

// Mounted at /rooms/:roomId/channels/:channelId/messages — a message
// always belongs to a specific channel now, so sending/listing requires
// naming one. Threads keep addressing by roomId + messageId only (no
// channelId segment): a reply's channel is implicit from its parent
// message, resolved server-side in message.service.ts, never supplied by
// the client — see createReply's channelId: parent.channelId.
const channelMessagesRouter = Router({ mergeParams: true });
channelMessagesRouter.post("/", authMiddleware, validateRoomAndChannelIdParams, create);
channelMessagesRouter.get("/", authMiddleware, validateRoomAndChannelIdParams, history);

// Mounted at /rooms/:roomId/messages — search spans every channel in the
// room (unchanged), and thread endpoints are addressed by messageId alone.
const roomMessagesRouter = Router({ mergeParams: true });
roomMessagesRouter.get("/search", authMiddleware, validateRoomIdParam, search);
roomMessagesRouter.post("/:messageId/replies", authMiddleware, validateRoomAndMessageIdParams, createThreadReply);
roomMessagesRouter.get("/:messageId/replies", authMiddleware, validateRoomAndMessageIdParams, listThreadReplies);

export { channelMessagesRouter, roomMessagesRouter };
