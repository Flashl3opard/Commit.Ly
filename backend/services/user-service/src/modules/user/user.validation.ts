import { z } from "zod";

export const updateProfileSchema = z
  .object({
    username: z.string().trim().min(3).max(32),
    displayName: z.string().trim().min(1).max(64),
    avatarUrl: z.string().trim().url(),
    bio: z.string().trim().max(160),
    role: z.string().trim().max(64),
    location: z.string().trim().max(64),
    customStatus: z.string().trim().max(120),
    skills: z
      .array(z.string().trim().min(1).max(32))
      .max(8)
      .refine((skills) => new Set(skills).size === skills.length, {
        message: "Skills must not contain duplicates",
      }),
  })
  .partial();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
