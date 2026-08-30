import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { registerSchema, loginSchema } from "./auth.validation";
import { registerUser, loginUser, getUserById } from "./auth.service";

const COOKIE_NAME = "token";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
  });
}

export async function register(req: Request, res: Response) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    const { user, token } = await registerUser(parsed.data);
    setAuthCookie(res, token);
    return res.status(201).json({ user });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "field";
      return res.status(409).json({ error: `${target} already in use` });
    }
    throw err;
  }
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const result = await loginUser(parsed.data);
  if (!result) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  setAuthCookie(res, result.token);
  return res.status(200).json({ user: result.user });
}

export async function me(req: Request, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await getUserById(userId);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return res.status(200).json({ user });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
  return res.status(200).json({ message: "Logged out" });
}
