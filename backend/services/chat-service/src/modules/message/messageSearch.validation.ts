import { z } from "zod";

export const searchMessagesQuerySchema = z
  .object({
    q: z.string().trim().min(1, "Search query cannot be blank."),
  })
  .strict();

export type SearchMessagesQuery = z.infer<typeof searchMessagesQuerySchema>;
