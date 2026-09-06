"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoomSidebar } from "@/components/rooms/RoomSidebar";

export default function RoomsLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell fillHeight>
      <div className="flex min-h-0 h-full flex-1 flex-col md:flex-row">
        <RoomSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </AppShell>
  );
}
