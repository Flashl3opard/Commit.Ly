import type { Request, Response } from "express";
import { createDmMessageSchema, editDmMessageSchema, listDmMessagesQuerySchema } from "./dm.validation";
import {
  getOrCreateConversation,
  listConversations,
  createDmMessage,
  getDmMessageHistory,
  editDmMessage,
  deleteDmMessage,
  DmServiceError,
} from "./dm.service";
import { broadcastDmMessageEvent } from "../ws/wsServer";

function handleServiceError(err: unknown, res: Response) {
  if (err instanceof DmServiceError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

export async function listMyConversations(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const conversations = await listConversations(userId);
  return res.status(200).json({ conversations });
}

export async function openConversation(req: Request<Record<string, never>, unknown, { userId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const otherUserId = req.body?.userId;
  if (typeof otherUserId !== "string" || otherUserId.length === 0) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const conversation = await getOrCreateConversation(userId, otherUserId);
    return res.status(200).json({ conversation });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function create(req: Request<{ conversationId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = createDmMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid message content", details: parsed.error.flatten() });
  }

  try {
    const message = await createDmMessage(req.params.conversationId, userId, parsed.data);
    broadcastDmMessageEvent(message.conversationId, "dm.message.created", message);
    return res.status(201).json({ message });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function history(req: Request<{ conversationId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = listDmMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid pagination parameters", details: parsed.error.flatten() });
  }

  try {
    const page = await getDmMessageHistory(req.params.conversationId, userId, parsed.data);
    return res.status(200).json(page);
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function edit(req: Request<{ messageId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = editDmMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid message content", details: parsed.error.flatten() });
  }

  try {
    const message = await editDmMessage(req.params.messageId, userId, parsed.data);
    broadcastDmMessageEvent(message.conversationId, "dm.message.updated", message);
    return res.status(200).json({ message });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function remove(req: Request<{ messageId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const deleted = await deleteDmMessage(req.params.messageId, userId);
    broadcastDmMessageEvent(deleted.conversationId, "dm.message.deleted", deleted);
    return res.status(200).json({ message: deleted });
  } catch (err) {
    return handleServiceError(err, res);
  }
}
