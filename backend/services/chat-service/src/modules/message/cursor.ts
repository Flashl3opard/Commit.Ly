/**
 * Opaque cursor wrapping a message's `sequence` value (a BigInt
 * autoincrement column used purely for deterministic ordering — see the
 * Message model's doc comment in schema.prisma). Callers never see or
 * reason about `sequence` directly; they pass the cursor string back
 * verbatim as `before`.
 */
export class InvalidCursorError extends Error {}

export function encodeCursor(sequence: bigint): string {
  return Buffer.from(sequence.toString(), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): bigint {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new InvalidCursorError("Invalid pagination cursor.");
  }

  if (!/^\d+$/.test(decoded)) {
    throw new InvalidCursorError("Invalid pagination cursor.");
  }

  try {
    return BigInt(decoded);
  } catch {
    throw new InvalidCursorError("Invalid pagination cursor.");
  }
}
