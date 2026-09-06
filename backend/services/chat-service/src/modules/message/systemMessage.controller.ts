import type { Request, Response } from "express";
import { createSystemMessageSchema } from "./systemMessage.validation";
import { createSystemMessage } from "./message.service";
import { broadcastMessageEvent } from "../ws/wsServer";

/**
 * Internal-only endpoint: creates a GitHub activity system message in a
 * room and broadcasts it exactly like a normal user message would be —
 * reusing the existing message.created WebSocket event so the frontend
 * needs no new realtime protocol. Authentication is the shared internal
 * service secret (see internalServiceMiddleware), never a user JWT — this
 * must never be reachable from the browser or impersonate a user.
 *
 * Broadcast only ever happens after persistence succeeds (never before) —
 * if prisma.message.create throws, this handler throws too, before
 * broadcastMessageEvent is reached, and Express's error handler returns a
 * 500 so the caller (GitHub Service) knows to retry rather than assuming
 * the message exists.
 */
export async function createSystemMessageHandler(req: Request<{ roomId: string }>, res: Response) {
  const parsed = createSystemMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid system message payload", details: parsed.error.flatten() });
  }

  const message = await createSystemMessage(req.params.roomId, parsed.data);
  broadcastMessageEvent(message.roomId, "message.created", message);

  return res.status(201).json({ message });
}
