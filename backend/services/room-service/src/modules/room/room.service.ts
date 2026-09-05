import bcrypt from "bcrypt";
import { Prisma, RoomRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { generateUniqueRoomCode } from "./roomCode";
import { getRepositoryById, GithubServiceError } from "../github/githubServiceClient";
import { getPublicProfile } from "../user/userServiceClient";
import type { CreateRoomInput, JoinRoomInput } from "./room.validation";

const BCRYPT_COST = 10;
// A fixed, valid bcrypt hash with no corresponding real password — used only
// to keep the "room not found" path's timing similar to a real password
// mismatch, so response timing can't be used to enumerate room codes.
const DUMMY_PASSWORD_HASH = "$2b$10$4NGhnl93UzagRrNfwwqO.uL4gaclwE9oPnR8D1f.aWrH9VvV6Kk/q";

export class RoomServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type SafeRoomSummary = {
  id: string;
  name: string;
  roomCode: string;
  repository: { name: string; fullName: string; htmlUrl: string };
  role: RoomRole;
  createdAt: Date;
};

export type SafeRoomDetails = {
  id: string;
  name: string;
  roomCode: string;
  repository: { name: string; fullName: string; htmlUrl: string; private: boolean; defaultBranch: string | null };
  currentUserRole: RoomRole;
  createdAt: Date;
  members: SafeRoomMember[];
};

export type SafeRoomMember = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomRole;
  joinedAt: Date;
};

/**
 * Verifies the submitted GitHub repository record is real, belongs to a
 * GitHub App installation owned by the requesting Commit.ly user, and that
 * the installation is still active. Never trusts repository metadata (name,
 * full name, URL) supplied by the frontend — only the internal record ID.
 */
async function assertRepositoryOwnership(userId: string, githubRepositoryId: string) {
  let repository;
  try {
    repository = await getRepositoryById(githubRepositoryId);
  } catch (err) {
    if (err instanceof GithubServiceError) {
      throw new RoomServiceError("Unable to verify repository access. Please try again.", 502);
    }
    throw err;
  }

  if (!repository) {
    throw new RoomServiceError("Repository not found.", 404);
  }

  if (!repository.active || repository.installationOwnerUserId !== userId) {
    throw new RoomServiceError("You do not have access to this repository.", 403);
  }

  return repository;
}

export async function createRoom(userId: string, input: CreateRoomInput): Promise<SafeRoomSummary> {
  const repository = await assertRepositoryOwnership(userId, input.githubRepositoryId);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
  const roomCode = await generateUniqueRoomCode();

  try {
    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          name: input.name,
          roomCode,
          passwordHash,
          ownerUserId: userId,
          githubRepositoryId: repository.id,
        },
      });

      await tx.roomMember.create({
        data: { roomId: created.id, userId, role: RoomRole.OWNER },
      });

      return created;
    });

    return {
      id: room.id,
      name: room.name,
      roomCode: room.roomCode,
      repository: { name: repository.name, fullName: repository.fullName, htmlUrl: repository.htmlUrl },
      role: RoomRole.OWNER,
      createdAt: room.createdAt,
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined) ?? [];
      if (target.includes("githubRepositoryId")) {
        throw new RoomServiceError("A room already exists for this repository.", 409);
      }
      throw new RoomServiceError("Could not create room due to a conflicting value.", 409);
    }
    throw err;
  }
}

export async function joinRoom(
  userId: string,
  input: JoinRoomInput,
): Promise<{ id: string; name: string; roomCode: string; role: RoomRole }> {
  const room = await prisma.room.findUnique({ where: { roomCode: input.roomCode } });

  // Constant-shape response whether the room is missing or the password is
  // wrong, to avoid letting room codes be enumerated via response timing/shape.
  const genericError = () => new RoomServiceError("Invalid room code or password.", 400);

  if (!room) {
    // Still runs a bcrypt compare against a fixed dummy hash so this path
    // takes roughly the same time as a real password mismatch.
    await bcrypt.compare(input.password, DUMMY_PASSWORD_HASH);
    throw genericError();
  }

  const passwordMatches = await bcrypt.compare(input.password, room.passwordHash);
  if (!passwordMatches) {
    throw genericError();
  }

  const existingMembership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId: room.id, userId } },
  });

  const role = existingMembership?.role ?? RoomRole.MEMBER;

  if (!existingMembership) {
    await prisma.roomMember.create({
      data: { roomId: room.id, userId, role: RoomRole.MEMBER },
    });
  }

  return { id: room.id, name: room.name, roomCode: room.roomCode, role };
}

export async function getRoomsForUser(userId: string): Promise<SafeRoomSummary[]> {
  const memberships = await prisma.roomMember.findMany({
    where: { userId },
    include: { room: { include: { githubRepository: true } } },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((membership) => ({
    id: membership.room.id,
    name: membership.room.name,
    roomCode: membership.room.roomCode,
    repository: {
      name: membership.room.githubRepository.name,
      fullName: membership.room.githubRepository.fullName,
      htmlUrl: membership.room.githubRepository.htmlUrl,
    },
    role: membership.role,
    createdAt: membership.room.createdAt,
  }));
}

export async function getRoomDetails(userId: string, roomId: string): Promise<SafeRoomDetails> {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    // Room existence is not distinguished from lack of access — both look
    // like "not found" to a non-member.
    throw new RoomServiceError("Room not found.", 404);
  }

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      githubRepository: true,
      members: { orderBy: { joinedAt: "asc" } },
    },
  });

  if (!room) {
    throw new RoomServiceError("Room not found.", 404);
  }

  const members: SafeRoomMember[] = await Promise.all(
    room.members.map(async (member) => {
      const profile = await getPublicProfile(member.userId);
      return {
        userId: member.userId,
        username: profile?.username ?? null,
        displayName: profile?.displayName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
        role: member.role,
        joinedAt: member.joinedAt,
      };
    }),
  );

  return {
    id: room.id,
    name: room.name,
    roomCode: room.roomCode,
    repository: {
      name: room.githubRepository.name,
      fullName: room.githubRepository.fullName,
      htmlUrl: room.githubRepository.htmlUrl,
      private: room.githubRepository.private,
      defaultBranch: room.githubRepository.defaultBranch,
    },
    currentUserRole: membership.role,
    createdAt: room.createdAt,
    members,
  };
}

export async function leaveRoom(userId: string, roomId: string): Promise<void> {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    throw new RoomServiceError("Room not found.", 404);
  }

  if (membership.role === RoomRole.OWNER) {
    throw new RoomServiceError("Room owner cannot leave the room.", 400);
  }

  await prisma.roomMember.delete({
    where: { roomId_userId: { roomId, userId } },
  });
}

export async function deleteRoom(userId: string, roomId: string): Promise<void> {
  const room = await prisma.room.findUnique({ where: { id: roomId } });

  if (!room) {
    throw new RoomServiceError("Room not found.", 404);
  }

  if (room.ownerUserId !== userId) {
    throw new RoomServiceError("Only the room owner can delete this room.", 403);
  }

  await prisma.$transaction([
    prisma.roomMember.deleteMany({ where: { roomId } }),
    prisma.room.delete({ where: { id: roomId } }),
  ]);
}
