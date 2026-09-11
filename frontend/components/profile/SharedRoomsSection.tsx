"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Hash, Loader2 } from "lucide-react";
import { getSharedRooms, type Room } from "@/lib/api/rooms";

export function SharedRoomsSection({ userId }: { userId: string }) {
  const [rooms, setRooms] = useState<Room[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRooms(null);

    getSharedRooms(userId)
      .then(({ rooms: fetched }) => {
        if (!cancelled) setRooms(fetched);
      })
      .catch(() => {
        if (!cancelled) setRooms([]);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (rooms === null) {
    return (
      <div className="glass-panel flex items-center justify-center rounded-2xl p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-2" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-foreground">Rooms in common</h2>

      {rooms.length === 0 ? (
        <p className="mt-3 text-sm text-muted-2">You don&apos;t share any rooms yet.</p>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {rooms.map((room) => (
            <li key={room.id}>
              <Link
                href={`/rooms/${room.id}`}
                className="focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover-surface"
              >
                <Hash className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
                <span className="truncate">{room.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
