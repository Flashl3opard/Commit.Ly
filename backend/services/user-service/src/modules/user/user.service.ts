import { prisma } from "../../config/prisma";
import type { UpdateProfileInput } from "./user.validation";

export type PrivateUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  customStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
  customStatus: string | null;
  createdAt: Date;
};

function toPrivateUser(user: {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  customStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PrivateUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    customStatus: user.customStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toPublicProfile(user: {
  id: string;
  username: string;
  avatarUrl: string | null;
  customStatus: string | null;
  createdAt: Date;
}): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    customStatus: user.customStatus,
    createdAt: user.createdAt,
  };
}

export async function getPrivateUserById(id: string): Promise<PrivateUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPrivateUser(user) : null;
}

export async function updateUserProfile(id: string, input: UpdateProfileInput): Promise<PrivateUser | null> {
  const user = await prisma.user.update({ where: { id }, data: input });
  return toPrivateUser(user);
}

export async function getPublicProfileById(id: string): Promise<PublicProfile | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? toPublicProfile(user) : null;
}
