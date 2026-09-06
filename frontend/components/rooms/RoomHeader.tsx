"use client";

import { Hash, ExternalLink, MoreHorizontal, Search, Users, Menu } from "lucide-react";
import { useRoomSidebarDrawer } from "@/lib/rooms/RoomSidebarContext";
import type { RoomDetails } from "@/lib/api/rooms";

type RoomHeaderProps = {
  room: RoomDetails;
  onOpenSettings: () => void;
  onToggleMembers?: () => void;
  onOpenSearch?: () => void;
};

export function RoomHeader({ room, onOpenSettings, onToggleMembers, onOpenSearch }: RoomHeaderProps) {
  const { openMobileSidebar } = useRoomSidebarDrawer();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={openMobileSidebar}
            title="Open rooms"
            aria-label="Open rooms"
            className="focus-ring shrink-0 rounded-lg p-1.5 text-muted-2 hover:bg-background-3 hover:text-foreground md:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
              <h1 className="truncate text-base font-semibold text-foreground">{room.name}</h1>
            </div>
            <div className="mt-0.5 flex items-center gap-2.5">
              <a
                href={room.repository.htmlUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex items-center gap-1.5 font-mono text-xs text-muted transition-colors hover:text-foreground"
              >
                {room.repository.fullName}
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <span className="inline-flex items-center gap-1 text-xs text-muted-2">
                <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                GitHub connected
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {onOpenSearch && (
            <button
              type="button"
              onClick={onOpenSearch}
              title="Search this room"
              aria-label="Search this room"
              className="focus-ring rounded-lg p-2 text-muted-2 transition-colors hover:bg-background-3 hover:text-foreground"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          {onToggleMembers && (
            <button
              type="button"
              onClick={onToggleMembers}
              title="Members"
              aria-label="Toggle members panel"
              className="focus-ring rounded-lg p-2 text-muted-2 transition-colors hover:bg-background-3 hover:text-foreground"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Room settings"
            aria-label="Room settings"
            className="focus-ring rounded-lg p-2 text-muted-2 transition-colors hover:bg-background-3 hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
