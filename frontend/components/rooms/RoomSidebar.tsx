"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FolderGit2, Plus, LogIn, Loader2 } from "lucide-react";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { CreateRoomDialog } from "./CreateRoomDialog";
import { JoinRoomDialog } from "./JoinRoomDialog";
import { RoomCreatedDialog } from "./RoomCreatedDialog";
import type { Room } from "@/lib/api/rooms";

export function RoomSidebar() {
  const { rooms, loading, error, addRoom } = useRooms();
  const router = useRouter();
  const pathname = usePathname();

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);

  function handleCreated(room: Room) {
    addRoom(room);
    setCreatedRoom(room);
    router.push(`/rooms/${room.id}`);
  }

  function handleJoined(room: Room) {
    addRoom(room);
    router.push(`/rooms/${room.id}`);
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-border bg-background-2/60 md:w-64">
      <div className="flex items-center justify-between px-4 pt-5 pb-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-2 uppercase">Workspaces</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setJoinOpen(true)}
            title="Join room"
            aria-label="Join room"
            className="focus-ring rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            title="Create room"
            aria-label="Create room"
            className="focus-ring rounded-lg p-1.5 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading rooms…
          </div>
        ) : error ? (
          <p className="px-2.5 py-3 text-sm text-danger">{error}</p>
        ) : rooms.length === 0 ? (
          <div className="px-2.5 py-4">
            <p className="text-sm font-medium text-foreground">No rooms yet</p>
            <p className="mt-1 text-sm text-muted">Create your first room to get started.</p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Create your first room
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {rooms.map((room) => {
              const isActive = pathname === `/rooms/${room.id}`;
              return (
                <li key={room.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/rooms/${room.id}`)}
                    aria-current={isActive ? "page" : undefined}
                    className={`focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-white/[0.07] text-foreground"
                        : "text-muted hover:bg-white/[0.04] hover:text-foreground"
                    }`}
                  >
                    <FolderGit2
                      className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-muted-2"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{room.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <JoinRoomDialog open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={handleJoined} />
      <RoomCreatedDialog room={createdRoom} onClose={() => setCreatedRoom(null)} />
    </aside>
  );
}
