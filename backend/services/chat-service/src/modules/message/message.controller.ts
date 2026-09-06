import type { Request, Response } from "express";
import { createMessageSchema, editMessageSchema, listMessagesQuerySchema } from "./message.validation";
import {
  createMessage,
  createReply,
  getThreadReplies,
  getMessageHistory,
  editMessage,
  deleteMessage,
  MessageServiceError,
} from "./message.service";
import { broadcastMessageEvent } from "../ws/wsServer";

function handleServiceError(err: unknown, res: Response) {
  if (err instanceof MessageServiceError) {
    return res.status(err.status).json({ error: err.message });
  }
  throw err;
}

export async function create(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid message content", details: parsed.error.flatten() });
  }

  try {
    const message = await createMessage(req.params.roomId, userId, parsed.data);
    broadcastMessageEvent(message.roomId, "message.created", message);
    return res.status(201).json({ message });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function createThreadReply(req: Request<{ roomId: string; messageId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = createMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid message content", details: parsed.error.flatten() });
  }

  try {
    const reply = await createReply(req.params.roomId, req.params.messageId, userId, parsed.data);
    broadcastMessageEvent(reply.roomId, "message.created", reply);
    return res.status(201).json({ message: reply });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function listThreadReplies(req: Request<{ roomId: string; messageId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const replies = await getThreadReplies(req.params.roomId, req.params.messageId, userId);
    return res.status(200).json({ messages: replies });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function history(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = listMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid pagination parameters", details: parsed.error.flatten() });
  }

  try {
    const page = await getMessageHistory(req.params.roomId, userId, parsed.data);
    return res.status(200).json(page);
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function edit(req: Request<{ messageId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = editMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid message content", details: parsed.error.flatten() });
  }

  try {
    const message = await editMessage(req.params.messageId, userId, parsed.data);
    broadcastMessageEvent(message.roomId, "message.updated", message);
    return res.status(200).json({ message });
  } catch (err) {
    return handleServiceError(err, res);
  }
}

export async function remove(req: Request<{ messageId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  try {
    const message = await deleteMessage(req.params.messageId, userId);
    broadcastMessageEvent(message.roomId, "message.deleted", message);
    return res.status(200).json({ message });
  } catch (err) {
    return handleServiceError(err, res);
  }
}
