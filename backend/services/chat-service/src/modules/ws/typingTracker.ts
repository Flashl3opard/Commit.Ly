/**
 * Ephemeral, in-memory typing state per room. Never persisted. A user is
 * considered "typing" until either an explicit typing.stop arrives or
 * TYPING_TIMEOUT_MS elapses since their last typing.start/refresh — this
 * auto-expiry covers a crashed tab or a dropped connection that never
 * sends typing.stop.
 */

const TYPING_TIMEOUT_MS = 5000;

type RoomId = string;
type UserId = string;

const typingTimers = new Map<RoomId, Map<UserId, ReturnType<typeof setTimeout>>>();

/**
 * Records that a user started (or is still) typing in a room. Returns
 * whether this is a *new* typing state (i.e. typing.started should be
 * broadcast) as opposed to a refresh of an already-known typing state
 * (which should NOT re-broadcast — the frontend debounces keystrokes into
 * infrequent typing.start sends, but a server-side refresh still shouldn't
 * spam a fresh event every time).
 */
export function startTyping(roomId: RoomId, userId: UserId, onTimeout: () => void): boolean {
  let roomTimers = typingTimers.get(roomId);
  if (!roomTimers) {
    roomTimers = new Map();
    typingTimers.set(roomId, roomTimers);
  }

  const existingTimer = roomTimers.get(userId);
  const isNew = !existingTimer;
  if (existingTimer) clearTimeout(existingTimer);

  const timer = setTimeout(() => {
    roomTimers?.delete(userId);
    if (roomTimers?.size === 0) typingTimers.delete(roomId);
    onTimeout();
  }, TYPING_TIMEOUT_MS);
  // Never let a pending typing-timeout keep the Node process alive on its own.
  timer.unref?.();

  roomTimers.set(userId, timer);
  return isNew;
}

/**
 * Records that a user explicitly stopped typing. Returns whether they were
 * actually in a typing state (i.e. typing.stopped should be broadcast) —
 * calling stop when nothing was tracked (e.g. a duplicate stop) is a no-op.
 */
export function stopTyping(roomId: RoomId, userId: UserId): boolean {
  const roomTimers = typingTimers.get(roomId);
  const timer = roomTimers?.get(userId);
  if (!roomTimers || !timer) return false;

  clearTimeout(timer);
  roomTimers.delete(userId);
  if (roomTimers.size === 0) typingTimers.delete(roomId);

  return true;
}

/** Clears typing state for a user across all rooms — called on disconnect. */
export function clearAllTypingForUser(userId: UserId): Array<{ roomId: RoomId }> {
  const cleared: Array<{ roomId: RoomId }> = [];

  for (const [roomId, roomTimers] of typingTimers) {
    const timer = roomTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      roomTimers.delete(userId);
      cleared.push({ roomId });
      if (roomTimers.size === 0) typingTimers.delete(roomId);
    }
  }

  return cleared;
}

export function isTyping(roomId: RoomId, userId: UserId): boolean {
  return Boolean(typingTimers.get(roomId)?.has(userId));
}
