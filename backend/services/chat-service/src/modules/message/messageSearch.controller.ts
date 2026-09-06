import type { Request, Response } from "express";
import { searchMessagesQuerySchema } from "./messageSearch.validation";
import { searchMessages, MessageServiceError } from "./message.service";

export async function search(req: Request<{ roomId: string }>, res: Response) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Authentication required." });

  const parsed = searchMessagesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid search query", details: parsed.error.flatten() });
  }

  try {
    const messages = await searchMessages(req.params.roomId, userId, parsed.data.q);
    return res.status(200).json({ messages });
  } catch (err) {
    if (err instanceof MessageServiceError) {
      return res.status(err.status).json({ error: err.message });
    }
    throw err;
  }
}
