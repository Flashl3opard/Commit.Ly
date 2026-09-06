"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { LAST_ROOM_STORAGE_KEY } from "@/lib/rooms/useLastVisitedRoom";

/**
 * The room is the application's home — there is no standalone dashboard.
 * Once the room list has loaded, send the user straight into their last
 * visited room (if it still exists), otherwise their first available room,
 * otherwise the empty /rooms state.
 */
export default function RootRedirectPage() {
  const { rooms, loading } = useRooms();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const lastRoomId = typeof window !== "undefined" ? window.localStorage.getItem(LAST_ROOM_STORAGE_KEY) : null;
    const target =
      (lastRoomId && rooms.some((room) => room.id === lastRoomId) ? lastRoomId : null) ?? rooms[0]?.id ?? null;

    router.replace(target ? `/rooms/${target}` : "/rooms");
  }, [loading, rooms, router]);

  return <AppShell>{null}</AppShell>;
}
