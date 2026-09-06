"use client";

import { useCallback, useState } from "react";

function storageKey(roomId: string): string {
  return `commitly:last-seen-message:${roomId}`;
}

function readLastSeenId(roomId: string): string | null {
  try {
    return localStorage.getItem(storageKey(roomId));
  } catch {
    return null;
  }
}

/**
 * Per-device unread count: compares the newest message id in the given
 * ordered list against the last id this browser marked as read for this
 * room. Not synced across devices/browsers — see spec §4a/§14 for why
 * that's an explicit, accepted limitation rather than an oversight.
 */
export function useUnreadCount(roomId: string, messageIds: string[]): { count: number; markRead: () => void } {
  const [lastSeenId, setLastSeenId] = useState<string | null>(() => readLastSeenId(roomId));

  const markRead = useCallback(() => {
    const newest = messageIds[messageIds.length - 1];
    if (!newest) return;
    try {
      localStorage.setItem(storageKey(roomId), newest);
    } catch {
      // Best-effort only — a private/blocked storage context simply
      // never persists an unread count, which is an acceptable silent
      // fallback for a per-device convenience feature.
    }
    setLastSeenId(newest);
  }, [roomId, messageIds]);

  if (lastSeenId === null) {
    return { count: 0, markRead };
  }

  const lastSeenIndex = messageIds.indexOf(lastSeenId);
  const count = lastSeenIndex === -1 ? 0 : messageIds.length - 1 - lastSeenIndex;

  return { count, markRead };
}
