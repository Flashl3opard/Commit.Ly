import { z } from "zod";

const MAX_CONTENT_LENGTH = 4000;

const contentSchema = z
  .string()
  .trim()
  .min(1, "Message content cannot be blank.")
  .max(MAX_CONTENT_LENGTH, `Message content cannot exceed ${MAX_CONTENT_LENGTH} characters.`);

export const createDmMessageSchema = z
  .object({
    content: contentSchema,
  })
  .strict();

export const editDmMessageSchema = z
  .object({
    content: contentSchema,
  })
  .strict();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export const listDmMessagesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    before: z.string().trim().min(1).optional(),
  })
  .strict();

export type CreateDmMessageInput = z.infer<typeof createDmMessageSchema>;
export type EditDmMessageInput = z.infer<typeof editDmMessageSchema>;
export type ListDmMessagesQuery = z.infer<typeof listDmMessagesQuerySchema>;

export { MAX_CONTENT_LENGTH, DEFAULT_LIMIT, MAX_LIMIT };
