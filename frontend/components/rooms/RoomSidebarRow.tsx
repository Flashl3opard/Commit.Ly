"use client";

import { useEffect } from "react";
import { FolderGit2 } from "lucide-react";
import { useUnreadCount } from "@/lib/rooms/useUnreadCount";
import type { Room } from "@/lib/api/rooms";

type RoomSidebarRowProps = {
  room: Room;
  isActive: boolean;
  activeRoomMessageIds: string[] | null;
  onNavigate: (roomId: string) => void;
};

export function RoomSidebarRow({ room, isActive, activeRoomMessageIds, onNavigate }: RoomSidebarRowProps) {
  const { count: unreadCount, markRead } = useUnreadCount(room.id, isActive ? (activeRoomMessageIds ?? []) : []);

  useEffect(() => {
    if (isActive) markRead();
    // Marks read whenever this row becomes the active room, and again
    // whenever the active room's message list grows while already
    // viewing it — both are the correct "the user has seen this" signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, activeRoomMessageIds?.length]);

  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(room.id)}
        aria-current={isActive ? "page" : undefined}
        className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
          isActive ? "bg-accent-soft text-foreground" : "text-muted hover:bg-background-3 hover:text-foreground"
        }`}
      >
        <FolderGit2 className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-muted-2"}`} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{room.name}</span>
        {!isActive && unreadCount > 0 && (
          <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </li>
  );
}
