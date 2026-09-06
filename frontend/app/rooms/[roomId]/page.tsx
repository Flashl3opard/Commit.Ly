"use client";

import { useEffect, useState, use } from "react";
import { Loader2 } from "lucide-react";
import { getRoom, type RoomDetails } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";
import { RoomHeader } from "@/components/rooms/RoomHeader";
import { RoomSettingsDialog } from "@/components/rooms/RoomSettingsDialog";
import { RoomChat } from "@/components/chat/RoomChat";
import { useCommandPalette } from "@/components/search/useCommandPalette";
import { CommandPalette } from "@/components/search/CommandPalette";
import { CommitlyMark } from "@/components/ui/CommitlyMark";

type LoadState =
  | { status: "loading"; roomId: string }
  | { status: "ready"; roomId: string; room: RoomDetails }
  | { status: "not-found"; roomId: string }
  | { status: "forbidden"; roomId: string }
  | { status: "error"; roomId: string };

export default function RoomDetailsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const [load, setLoad] = useState<LoadState>({ status: "loading", roomId });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const commandPalette = useCommandPalette();

  useEffect(() => {
    let cancelled = false;

    getRoom(roomId)
      .then(({ room: fetched }) => {
        if (cancelled) return;
        setLoad({ status: "ready", roomId, room: fetched });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          // Room Service treats "not a member" and "doesn't exist" the same
          // way (both 404), so this page never distinguishes them either —
          // doing so would leak room existence to non-members.
          setLoad({ status: err.status === 403 ? "forbidden" : "not-found", roomId });
          return;
        }
        setLoad({ status: "error", roomId });
      });

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // A render for a roomId that doesn't match the in-flight/loaded state
  // (i.e. the user navigated to a different room while this was still
  // resolving) is treated the same as "loading" rather than showing stale
  // content from the previous room.
  const current = load.roomId === roomId ? load : { status: "loading" as const, roomId };

  if (current.status === "loading") {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading room…
        </div>
      </main>
    );
  }

  if (current.status === "not-found" || current.status === "forbidden") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <CommitlyMark className="h-10 w-10 opacity-40 grayscale" />
        <h1 className="mt-4 text-base font-semibold text-foreground">
          {current.status === "forbidden" ? "You don't have access to this room." : "Room not found."}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          It may have been deleted, or you may need a room code and password to join.
        </p>
      </main>
    );
  }

  if (current.status === "error") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <CommitlyMark className="h-10 w-10 opacity-40 grayscale" />
        <h1 className="mt-4 text-base font-semibold text-foreground">
          Couldn&apos;t connect to Commit.ly
        </h1>
        <p className="mt-1.5 text-sm text-muted">Check that Room Service is running, then try again.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="focus-ring mt-4 rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-3"
        >
          Try again
        </button>
      </main>
    );
  }

  const { room } = current;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <RoomHeader room={room} onOpenSettings={() => setSettingsOpen(true)} onOpenSearch={commandPalette.open} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <RoomChat room={room} />
      </div>

      <RoomSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} room={room} />
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        currentRoom={{ id: room.id, repositoryId: room.repository.id }}
      />
    </div>
  );
}
