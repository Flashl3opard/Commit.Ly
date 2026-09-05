import { z } from "zod";

const MAX_CONTENT_LENGTH = 4000;

// Plain text only for v1 — no HTML, no Markdown rendering contract yet.
// Trimmed for the length/blank checks, but the original (untrimmed) value
// is what actually gets stored, preserving meaningful interior whitespace.
const contentSchema = z
  .string()
  .trim()
  .min(1, "Message content cannot be blank.")
  .max(MAX_CONTENT_LENGTH, `Message content cannot exceed ${MAX_CONTENT_LENGTH} characters.`);

export const createMessageSchema = z
  .object({
    content: contentSchema,
  })
  .strict();

export const editMessageSchema = z
  .object({
    content: contentSchema,
  })
  .strict();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const listMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    before: z.string().trim().min(1).optional(),
  })
  .strict();

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export { MAX_CONTENT_LENGTH, DEFAULT_LIMIT, MAX_LIMIT };
