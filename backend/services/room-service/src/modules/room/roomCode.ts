import { randomInt } from "node:crypto";
import { prisma } from "../../config/prisma";

const ROOM_CODE_MIN = 0;
const ROOM_CODE_MAX = 1_000_000; // exclusive upper bound -> 000000-999999
const MAX_ATTEMPTS = 10;

function generateCandidate(): string {
  // crypto.randomInt is a CSPRNG, unlike Math.random() — required since the
  // room code is part of how a room is located (not itself the credential;
  // the password is), but it must still not be predictable/enumerable.
  return randomInt(ROOM_CODE_MIN, ROOM_CODE_MAX).toString().padStart(6, "0");
}

/**
 * Generates a unique 6-digit room code, retrying on the rare collision.
 * Uniqueness is still enforced at the database level (Room.roomCode is
 * @unique) — this just avoids the common case of a wasted insert attempt.
 */
export async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const candidate = generateCandidate();
    const existing = await prisma.room.findUnique({ where: { roomCode: candidate }, select: { id: true } });
    if (!existing) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique room code after multiple attempts");
}
