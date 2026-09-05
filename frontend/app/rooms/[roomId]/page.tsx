"use client";

import { useEffect, useState, use } from "react";
import { Loader2, MessageSquare, ShieldAlert } from "lucide-react";
import { getRoom, type RoomDetails } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";
import { RoomHeader } from "@/components/rooms/RoomHeader";
import { RoomMembersPanel } from "@/components/rooms/RoomMembersPanel";
import { RoomSettingsDialog } from "@/components/rooms/RoomSettingsDialog";

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
        <ShieldAlert className="h-8 w-8 text-muted-2" aria-hidden="true" />
        <h1 className="mt-3 text-base font-semibold text-foreground">
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
        <ShieldAlert className="h-8 w-8 text-muted-2" aria-hidden="true" />
        <h1 className="mt-3 text-base font-semibold text-foreground">
          Couldn&apos;t connect to Commit.ly
        </h1>
        <p className="mt-1.5 text-sm text-muted">Check that Room Service is running, then try again.</p>
      </main>
    );
  }

  const { room } = current;

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <RoomHeader room={room} onOpenSettings={() => setSettingsOpen(true)} />

        <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <MessageSquare className="h-8 w-8 text-muted-2" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-foreground">Your workspace is ready.</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Chat and activity will appear here.
          </p>
        </main>
      </div>

      <RoomMembersPanel members={room.members} />

      <RoomSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} room={room} />
    </div>
  );
}
