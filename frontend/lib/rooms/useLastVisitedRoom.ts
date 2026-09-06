"use client";

import { useEffect } from "react";

export const LAST_ROOM_STORAGE_KEY = "commitly:last-room-id";

/**
 * Remembers the most recently opened room per-device so "/" can send the
 * user back into it. Only called once a room has actually loaded (never on
 * 403/404/error), so a dead or inaccessible room id is never remembered.
 */
export function useLastVisitedRoom(roomId: string | null) {
  useEffect(() => {
    if (!roomId) return;
    window.localStorage.setItem(LAST_ROOM_STORAGE_KEY, roomId);
  }, [roomId]);
}
