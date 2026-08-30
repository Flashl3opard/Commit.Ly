import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import { signToken } from "../../utils/jwt";
import type { RegisterInput, LoginInput } from "./auth.validation";

const BCRYPT_COST = 10;

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicUser(user: {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function registerUser(input: RegisterInput): Promise<{ user: PublicUser; token: string }> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
    },
  });

  const token = signToken({ userId: user.id });

  return { user: toPublicUser(user), token };
}

export async function loginUser(input: LoginInput): Promise<{ user: PublicUser; token: string } | null> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatches) {
    return null;
  }

  const token = signToken({ userId: user.id });

  return { user: toPublicUser(user), token };
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicUser(user) : null;
}
