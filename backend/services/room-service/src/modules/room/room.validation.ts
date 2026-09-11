import { z } from "zod";

export const createRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    githubRepositoryId: z.string().trim().min(1),
  })
  .strict();

export const joinRoomSchema = z
  .object({
    roomCode: z.string().trim().regex(/^\d{6}$/, "Room code must be exactly 6 digits"),
  })
  .strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
