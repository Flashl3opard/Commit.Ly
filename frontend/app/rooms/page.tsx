"use client";

import { useState } from "react";
import { FolderGit2, Plus, LogIn } from "lucide-react";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { CreateRoomDialog } from "@/components/rooms/CreateRoomDialog";
import { JoinRoomDialog } from "@/components/rooms/JoinRoomDialog";
import { RoomCreatedDialog } from "@/components/rooms/RoomCreatedDialog";
import type { Room } from "@/lib/api/rooms";
import { useRouter } from "next/navigation";

export default function RoomsIndexPage() {
  const { rooms, loading, addRoom } = useRooms();
  const router = useRouter();
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

  if (loading) {
    return null;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <FolderGit2 className="h-9 w-9 text-muted-2" aria-hidden="true" />

      {rooms.length === 0 ? (
        <>
          <h1 className="mt-4 text-lg font-semibold text-foreground">Your workspace is empty</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Create a room for a GitHub repository or join one using a room code.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-lg font-semibold text-foreground">Select a workspace</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Choose a room from the sidebar, or create a new one.
          </p>
        </>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create room
        </button>
        <button
          type="button"
          onClick={() => setJoinOpen(true)}
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Join room
        </button>
      </div>

      <CreateRoomDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
      <JoinRoomDialog open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={handleJoined} />
      <RoomCreatedDialog room={createdRoom} onClose={() => setCreatedRoom(null)} />
    </main>
  );
}
