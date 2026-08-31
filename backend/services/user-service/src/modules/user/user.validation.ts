import { z } from "zod";

export const updateProfileSchema = z
  .object({
    username: z.string().trim().min(3).max(32),
    avatarUrl: z.string().trim().url(),
    customStatus: z.string().trim().max(120),
  })
  .partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
