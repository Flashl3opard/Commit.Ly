import { z } from "zod";

export const searchUsersQuerySchema = z
  .object({
    username: z.string().trim().min(1).max(32),
  })
  .strict();

export const sendFriendRequestSchema = z
  .object({
    username: z.string().trim().min(1).max(32),
  })
  .strict();

export const respondToFriendRequestSchema = z
  .object({
    action: z.enum(["accept", "reject"]),
  })
  .strict();

export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
export type SendFriendRequestInput = z.infer<typeof sendFriendRequestSchema>;
export type RespondToFriendRequestInput = z.infer<typeof respondToFriendRequestSchema>;
