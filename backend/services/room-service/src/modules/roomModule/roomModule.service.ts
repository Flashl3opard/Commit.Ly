import { Prisma, type RoomModuleType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { assertRoomOwner, RoomServiceError } from "../room/room.service";
import type { CreateRoomModuleInput, UpdateRoomModuleInput } from "./roomModule.validation";

export type SafeRoomModule = {
  id: string;
  roomId: string;
  type: RoomModuleType;
  name: string;
  position: number;
  enabled: boolean;
  config: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_MODULE_NAMES: Record<RoomModuleType, string> = {
  CHAT: "Chat",
  GITHUB_ACTIVITY: "GitHub Activity",
  MEMBERS: "Members",
  TASKS: "Tasks",
  NOTES: "Notes",
  RELEASES: "Releases",
};

/**
 * Any current member can see which modules exist and are enabled — this
 * is what drives the icon rail's contents for every room visitor, not
 * just the owner. Disabled modules are still returned (not filtered out)
 * so the frontend can decide how to represent "owner turned this off"
 * rather than the module silently vanishing with no explanation.
 */
export async function listRoomModules(userId: string, roomId: string): Promise<SafeRoomModule[]> {
  const membership = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!membership) {
    throw new RoomServiceError("Room not found.", 404);
  }

  return prisma.roomModule.findMany({
    where: { roomId },
    orderBy: { position: "asc" },
  });
}

export async function createRoomModule(
  userId: string,
  roomId: string,
  input: CreateRoomModuleInput,
): Promise<SafeRoomModule> {
  await assertRoomOwner(userId, roomId);

  const maxPosition = await prisma.roomModule.aggregate({
    where: { roomId },
    _max: { position: true },
  });

  try {
    return await prisma.roomModule.create({
      data: {
        roomId,
        type: input.type,
        name: input.name ?? DEFAULT_MODULE_NAMES[input.type],
        position: (maxPosition._max.position ?? -1) + 1,
        createdBy: userId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new RoomServiceError(`This room already has a ${DEFAULT_MODULE_NAMES[input.type]} module.`, 409);
    }
    throw err;
  }
}

async function loadModuleInRoom(roomId: string, moduleId: string) {
  const module_ = await prisma.roomModule.findUnique({ where: { id: moduleId } });
  if (!module_ || module_.roomId !== roomId) {
    throw new RoomServiceError("Module not found.", 404);
  }
  return module_;
}

export async function updateRoomModule(
  userId: string,
  roomId: string,
  moduleId: string,
  input: UpdateRoomModuleInput,
): Promise<SafeRoomModule> {
  await assertRoomOwner(userId, roomId);
  const module_ = await loadModuleInRoom(roomId, moduleId);

  if (module_.type === "CHAT" && input.enabled === false) {
    // Chat is the room's baseline communication surface — disabling it
    // would leave a room with no way for members to talk at all inside
    // Commit.ly. Members/GitHub Activity have no such structural floor
    // (a room can reasonably exist without either visible) so only Chat
    // is protected here.
    throw new RoomServiceError("The Chat module cannot be disabled.", 400);
  }

  return prisma.roomModule.update({
    where: { id: moduleId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.config !== undefined ? { config: input.config as Prisma.InputJsonValue | undefined } : {}),
    },
  });
}

export async function removeRoomModule(userId: string, roomId: string, moduleId: string): Promise<void> {
  await assertRoomOwner(userId, roomId);
  const module_ = await loadModuleInRoom(roomId, moduleId);

  if (module_.type === "CHAT") {
    throw new RoomServiceError("The Chat module cannot be removed.", 400);
  }

  await prisma.roomModule.delete({ where: { id: moduleId } });
}
