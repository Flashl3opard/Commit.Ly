import { prisma } from "../../config/prisma";
import type { UpdateProfileInput } from "./user.validation";

type UserRecord = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  location: string | null;
  customStatus: string | null;
  githubId: string | null;
  githubUsername: string | null;
  githubVerified: boolean;
  profileCompleted: boolean;
  skills: { skill: string }[];
  createdAt: Date;
  updatedAt: Date;
};

export type PrivateUser = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  location: string | null;
  customStatus: string | null;
  githubUsername: string | null;
  githubVerified: boolean;
  profileCompleted: boolean;
  skills: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type PublicProfile = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: string | null;
  location: string | null;
  customStatus: string | null;
  githubUsername: string | null;
  githubVerified: boolean;
  skills: string[];
  createdAt: Date;
};

function toPrivateUser(user: UserRecord): PrivateUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    location: user.location,
    customStatus: user.customStatus,
    githubUsername: user.githubUsername,
    githubVerified: user.githubVerified,
    profileCompleted: user.profileCompleted,
    skills: user.skills.map((s) => s.skill),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toPublicProfile(user: UserRecord): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    location: user.location,
    customStatus: user.customStatus,
    githubUsername: user.githubUsername,
    githubVerified: user.githubVerified,
    skills: user.skills.map((s) => s.skill),
    createdAt: user.createdAt,
  };
}

export async function getPrivateUserById(id: string): Promise<PrivateUser | null> {
  const user = await prisma.user.findUnique({ where: { id }, include: { skills: true } });
  return user ? toPrivateUser(user) : null;
}

export async function updateUserProfile(id: string, input: UpdateProfileInput): Promise<PrivateUser | null> {
  const { skills, ...fields } = input;

  const user = await prisma.$transaction(async (tx) => {
    if (skills) {
      await tx.userSkill.deleteMany({ where: { userId: id } });
      if (skills.length > 0) {
        await tx.userSkill.createMany({
          data: skills.map((skill) => ({ userId: id, skill })),
        });
      }
    }

    const current = await tx.user.update({ where: { id }, data: fields });

    if (!current.profileCompleted && current.displayName && current.username) {
      await tx.user.update({ where: { id }, data: { profileCompleted: true } });
    }

    return tx.user.findUniqueOrThrow({ where: { id }, include: { skills: true } });
  });

  return toPrivateUser(user);
}

export async function getPublicProfileById(id: string): Promise<PublicProfile | null> {
  const user = await prisma.user.findUnique({ where: { id }, include: { skills: true } });
  return user ? toPublicProfile(user) : null;
}

/**
 * Links a verified GitHub identity to a Commit.ly user. Only callable via
 * the internal service boundary (see internalServiceMiddleware) — never
 * reachable from a normal profile update.
 */
export async function linkGithubIdentity(
  userId: string,
  githubId: string,
  githubUsername: string,
): Promise<PrivateUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { githubId, githubUsername, githubVerified: true },
    include: { skills: true },
  });
  return toPrivateUser(user);
}

/**
 * Removes a linked GitHub identity from a Commit.ly user. Only callable via
 * the internal service boundary.
 */
export async function unlinkGithubIdentity(userId: string): Promise<PrivateUser> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { githubId: null, githubUsername: null, githubVerified: false },
    include: { skills: true },
  });
  return toPrivateUser(user);
}

export async function getUserByGithubId(githubId: string): Promise<{ id: string } | null> {
  return prisma.user.findUnique({ where: { githubId }, select: { id: true } });
}
