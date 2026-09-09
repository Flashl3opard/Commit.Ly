import { z } from "zod";

// Mirrors the shape of a Slack/Discord channel name closely enough to be
// familiar, sanitized to a small safe character set so it can always be
// rendered as "#name" without any escaping concerns.
const channelNameSchema = z
  .string()
  .trim()
  .min(1, "Channel name cannot be blank.")
  .max(32, "Channel name cannot exceed 32 characters.")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Channel name must be lowercase letters, numbers, and hyphens only.");

export const createChannelSchema = z
  .object({
    name: channelNameSchema,
    description: z.string().trim().max(280).optional(),
    icon: z.string().trim().max(64).optional(),
  })
  .strict();

export const updateChannelSchema = z
  .object({
    name: channelNameSchema.optional(),
    description: z.string().trim().max(280).nullable().optional(),
    icon: z.string().trim().max(64).nullable().optional(),
    position: z.number().int().min(0).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided.");

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
