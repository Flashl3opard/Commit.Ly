import { z } from "zod";

export const linkGithubSchema = z.object({
  githubId: z.string().trim().min(1),
  githubUsername: z.string().trim().min(1),
});

export type LinkGithubInput = z.infer<typeof linkGithubSchema>;
