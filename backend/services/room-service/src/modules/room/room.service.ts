import { Prisma, RoomRole } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { generateUniqueRoomCode } from "./roomCode";
import { getRepositoryById, GithubServiceError } from "../github/githubServiceClient";
import { getPublicProfile } from "../user/userServiceClient";
import type { CreateRoomInput, JoinRoomInput } from "./room.validation";

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
  repository: { id: string; name: string; fullName: string; htmlUrl: string; private: boolean; defaultBranch: string | null };
  currentUserRole: RoomRole;
  createdAt: Date;
  members: SafeRoomMember[];
};

export type SafeRoomMember = {
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  customStatus: string | null;
  githubVerified: boolean;
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

  const roomCode = await generateUniqueRoomCode();

  try {
    const room = await prisma.$transaction(async (tx) => {
      const created = await tx.room.create({
        data: {
          name: input.name,
          roomCode,
          ownerUserId: userId,
          githubRepositoryId: repository.id,
        },
      });

      await tx.roomMember.create({
        data: { roomId: created.id, userId, role: RoomRole.OWNER },
      });

      // Every room starts with the same sane default configuration:
      // a mandatory #general channel and the three initial modules. This
      // is the same shape the add_channels_and_modules migration backfilled
      // onto every pre-existing room, so new and old rooms never diverge.
      await tx.channel.create({
        data: { roomId: created.id, name: "general", isDefault: true, position: 0, createdBy: userId },
      });

      await tx.roomModule.createMany({
        data: [
          { roomId: created.id, type: "CHAT", name: "Chat", position: 0, createdBy: userId },
          { roomId: created.id, type: "GITHUB_ACTIVITY", name: "GitHub Activity", position: 1, createdBy: userId },
          { roomId: created.id, type: "MEMBERS", name: "Members", position: 2, createdBy: userId },
        ],
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

  if (!room) {
    throw new RoomServiceError("Room not found. Check the room code and try again.", 404);
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

/**
 * Rooms the requesting user and otherUserId both belong to — used by a
 * profile page to show "rooms in common." Scoped to the requester's own
 * membership first (never leaks which rooms otherUserId is in beyond
 * what the requester is already a member of).
 */
export async function getSharedRooms(userId: string, otherUserId: string): Promise<SafeRoomSummary[]> {
  const memberships = await prisma.roomMember.findMany({
    where: {
      userId,
      room: { members: { some: { userId: otherUserId } } },
    },
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
        customStatus: profile?.customStatus ?? null,
        githubVerified: profile?.githubVerified ?? false,
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
      id: room.githubRepository.id,
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

/**
 * Shared authorization gate for every owner-only room-structure action
 * (channel create/rename/archive, module add/remove/reorder). Checks
 * RoomMember.role, not Room.ownerUserId — the same field every other
 * service sees via the internal membership endpoint, so "OWNER" means the
 * identical thing everywhere in the system. Room.ownerUserId remains the
 * authority for delete-room specifically (pre-existing behavior, left
 * unchanged); the two fields are always written together at room creation
 * and there is still no path that could desync them.
 */
export async function assertRoomOwner(userId: string, roomId: string): Promise<void> {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    // Same non-disclosure shape as getRoomDetails — a non-member can't
    // distinguish "room doesn't exist" from "you're not in it."
    throw new RoomServiceError("Room not found.", 404);
  }

  if (membership.role !== RoomRole.OWNER) {
    throw new RoomServiceError("Only the room owner can do this.", 403);
  }
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
