import { z } from "zod";

export const createRoomSchema = z
  .object({
    name: z.string().trim().min(1).max(64),
    githubRepositoryId: z.string().trim().min(1),
    password: z.string().min(6).max(128),
  })
  .strict();

export const joinRoomSchema = z
  .object({
    roomCode: z.string().trim().regex(/^\d{6}$/, "Room code must be exactly 6 digits"),
    password: z.string().min(1).max(128),
  })
  .strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
