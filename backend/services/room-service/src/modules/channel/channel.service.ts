import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { assertRoomOwner, RoomServiceError } from "../room/room.service";
import type { CreateChannelInput, UpdateChannelInput } from "./channel.validation";

export type SafeChannel = {
  id: string;
  roomId: string;
  name: string;
  description: string | null;
  icon: string | null;
  position: number;
  isDefault: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Any current member (not just the owner) can view a room's non-archived
 * channels — this mirrors getRoomDetails' membership-only gate. Archived
 * channels are hidden from the normal list (they're not deleted, just
 * removed from the room's active navigation).
 */
export async function listChannels(userId: string, roomId: string): Promise<SafeChannel[]> {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    throw new RoomServiceError("Room not found.", 404);
  }

  const channels = await prisma.channel.findMany({
    where: { roomId, archivedAt: null },
    orderBy: { position: "asc" },
  });

  return channels;
}

export async function createChannel(userId: string, roomId: string, input: CreateChannelInput): Promise<SafeChannel> {
  await assertRoomOwner(userId, roomId);

  const maxPosition = await prisma.channel.aggregate({
    where: { roomId },
    _max: { position: true },
  });

  try {
    return await prisma.channel.create({
      data: {
        roomId,
        name: input.name,
        description: input.description ?? null,
        icon: input.icon ?? null,
        position: (maxPosition._max.position ?? -1) + 1,
        createdBy: userId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new RoomServiceError(`A channel named "${input.name}" already exists in this room.`, 409);
    }
    throw err;
  }
}

async function loadChannelInRoom(roomId: string, channelId: string) {
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.roomId !== roomId) {
    throw new RoomServiceError("Channel not found.", 404);
  }
  return channel;
}

export async function updateChannel(
  userId: string,
  roomId: string,
  channelId: string,
  input: UpdateChannelInput,
): Promise<SafeChannel> {
  await assertRoomOwner(userId, roomId);
  const channel = await loadChannelInRoom(roomId, channelId);

  if (channel.isDefault) {
    // general can be reordered/described, but never renamed away from its
    // protected name and never archived — a room can never end up with
    // zero usable channels.
    if (input.name !== undefined && input.name !== channel.name) {
      throw new RoomServiceError('The "general" channel cannot be renamed.', 400);
    }
    if (input.archived) {
      throw new RoomServiceError('The "general" channel cannot be archived.', 400);
    }
  }

  try {
    return await prisma.channel.update({
      where: { id: channelId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.archived !== undefined ? { archivedAt: input.archived ? new Date() : null } : {}),
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new RoomServiceError(`A channel named "${input.name}" already exists in this room.`, 409);
    }
    throw err;
  }
}

/**
 * Archive, never hard-delete — a channel's message history stays intact
 * in Chat Service (messages keep their channelId), just hidden from the
 * room's active channel list. Matches the spec's explicit preference for
 * archive/deactivate semantics over destructive deletion.
 */
export async function archiveChannel(userId: string, roomId: string, channelId: string): Promise<SafeChannel> {
  await assertRoomOwner(userId, roomId);
  const channel = await loadChannelInRoom(roomId, channelId);

  if (channel.isDefault) {
    throw new RoomServiceError('The "general" channel cannot be archived.', 400);
  }

  return prisma.channel.update({
    where: { id: channelId },
    data: { archivedAt: new Date() },
  });
}
