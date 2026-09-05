import type { Request, Response } from "express";
import { createMessageSchema } from "./message.validation";
import { createMessage, MessageServiceError } from "./message.service";

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
    return res.status(201).json({ message });
  } catch (err) {
    return handleServiceError(err, res);
  }
}
