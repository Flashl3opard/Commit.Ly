import { Router } from "express";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { listMyConversations, openConversation, create, history, edit, remove } from "./dm.controller";
import { authMiddleware } from "../../middleware/authMiddleware";

const conversationIdParamSchema = z.object({ conversationId: z.string().uuid() });

function validateConversationIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = conversationIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid conversation id." });
  }
  return next();
}

const messageIdParamSchema = z.object({ messageId: z.string().uuid() });

function validateMessageIdParam(req: Request, res: Response, next: NextFunction) {
  const parsed = messageIdParamSchema.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid message id." });
  }
  return next();
}

// Mounted at /dm/conversations
const conversationsRouter = Router();
conversationsRouter.get("/", authMiddleware, listMyConversations);
conversationsRouter.post("/", authMiddleware, openConversation);
conversationsRouter.post("/:conversationId/messages", authMiddleware, validateConversationIdParam, create);
conversationsRouter.get("/:conversationId/messages", authMiddleware, validateConversationIdParam, history);

// Mounted at /dm/messages
const messagesRouter = Router();
messagesRouter.patch("/:messageId", authMiddleware, validateMessageIdParam, edit);
messagesRouter.delete("/:messageId", authMiddleware, validateMessageIdParam, remove);

export { conversationsRouter, messagesRouter };
