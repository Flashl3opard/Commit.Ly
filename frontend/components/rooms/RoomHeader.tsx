"use client";

import { Hash, ExternalLink, Settings } from "lucide-react";
import type { RoomDetails } from "@/lib/api/rooms";

export function RoomHeader({ room, onOpenSettings }: { room: RoomDetails; onOpenSettings: () => void }) {
  return (
    <header className="border-b border-border px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Hash className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
            <h1 className="truncate text-base font-semibold text-foreground">{room.name}</h1>
          </div>
          <a
            href={room.repository.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="focus-ring mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
          >
            {room.repository.fullName}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          title="Room settings"
          aria-label="Room settings"
          className="focus-ring shrink-0 rounded-lg p-2 text-muted-2 transition-colors hover:bg-white/5 hover:text-foreground"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
