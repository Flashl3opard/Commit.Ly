"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderGit2, MoreHorizontal, LogOut, Loader2 } from "lucide-react";
import { useUnreadCount } from "@/lib/rooms/useUnreadCount";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { leaveRoom, type Room } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";

type RoomSidebarRowProps = {
  room: Room;
  isActive: boolean;
  activeRoomMessageIds: string[] | null;
  onNavigate: (roomId: string) => void;
};

export function RoomSidebarRow({ room, isActive, activeRoomMessageIds, onNavigate }: RoomSidebarRowProps) {
  const { count: unreadCount, markRead } = useUnreadCount(room.id, isActive ? (activeRoomMessageIds ?? []) : []);
  const { rooms, removeRoom } = useRooms();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isActive) markRead();
    // Marks read whenever this row becomes the active room, and again
    // whenever the active room's message list grows while already
    // viewing it — both are the correct "the user has seen this" signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, activeRoomMessageIds?.length]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  async function handleLeave() {
    setLeaving(true);
    try {
      await leaveRoom(room.id);
      removeRoom(room.id);
      const remaining = rooms.filter((r) => r.id !== room.id);
      if (isActive) {
        router.push(remaining.length > 0 ? `/rooms/${remaining[0].id}` : "/rooms");
      }
    } catch (err) {
      setLeaving(false);
      setConfirming(false);
      setMenuOpen(false);
      // Errors here are rare (network/already-left); the row simply stays
      // put and the user can retry from the kebab menu again.
      if (!(err instanceof ApiError)) throw err;
    }
  }

  return (
    <li className="group/row relative">
      <button
        type="button"
        onClick={() => onNavigate(room.id)}
        aria-current={isActive ? "page" : undefined}
        className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
          isActive
            ? "bg-room-sidebar-active text-room-sidebar-fg"
            : "text-room-sidebar-muted hover:bg-room-sidebar-active hover:text-room-sidebar-fg"
        }`}
      >
        <FolderGit2
          className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-room-sidebar-muted-2"}`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{room.name}</span>
        {!isActive && unreadCount > 0 && (
          <span className="shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold text-accent group-hover/row:hidden">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {room.role === "MEMBER" && (
        <div ref={menuRef} className="absolute top-1/2 right-1.5 -translate-y-1/2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            title="Room actions"
            aria-label="Room actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`focus-ring rounded-md p-1 text-room-sidebar-muted-2 opacity-0 transition-opacity group-hover/row:opacity-100 hover:bg-room-sidebar-active hover:text-room-sidebar-fg ${
              menuOpen ? "opacity-100" : ""
            }`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="glass-panel absolute top-full right-0 z-20 mt-1 w-40 rounded-lg p-1 shadow-2xl"
            >
              {confirming ? (
                <div className="p-1.5">
                  <p className="px-1 text-xs text-muted">Leave this room?</p>
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      onClick={handleLeave}
                      disabled={leaving}
                      className="focus-ring flex flex-1 items-center justify-center gap-1 rounded-md bg-danger-bg px-2 py-1 text-xs font-medium text-danger transition-colors hover:opacity-90 disabled:opacity-60"
                    >
                      {leaving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : "Leave"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      disabled={leaving}
                      className="focus-ring flex-1 rounded-md px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setConfirming(true)}
                  className="focus-ring flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-danger transition-colors hover:bg-danger-bg"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  Leave room
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
