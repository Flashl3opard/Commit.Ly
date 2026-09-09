import { z } from "zod";

// Kept in sync with the Prisma RoomModuleType enum by hand — Zod has no
// way to derive a literal union from a generated Prisma enum without
// pulling in the generated client as a runtime dependency of validation
// code, and this list changes rarely enough that the duplication is a
// reasonable trade (a mismatch would be caught immediately by the
// database's own enum constraint on write).
export const ROOM_MODULE_TYPES = [
  "CHAT",
  "GITHUB_ACTIVITY",
  "MEMBERS",
  "TASKS",
  "NOTES",
  "RELEASES",
] as const;

export const createRoomModuleSchema = z
  .object({
    type: z.enum(ROOM_MODULE_TYPES),
    name: z.string().trim().min(1).max(48).optional(),
  })
  .strict();

export const updateRoomModuleSchema = z
  .object({
    name: z.string().trim().min(1).max(48).optional(),
    position: z.number().int().min(0).optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, "At least one field must be provided.");

export type CreateRoomModuleInput = z.infer<typeof createRoomModuleSchema>;
export type UpdateRoomModuleInput = z.infer<typeof updateRoomModuleSchema>;
