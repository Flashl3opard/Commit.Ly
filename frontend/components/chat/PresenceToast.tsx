"use client";

import { useEffect } from "react";
import type { RoomMember } from "@/lib/api/rooms";

type PresenceToastProps = {
  events: { id: string; userId: string }[];
  members: RoomMember[];
  onDismiss: (userId: string) => void;
};

const VISIBLE_MS = 3000;

export function PresenceToast({ events, members, onDismiss }: PresenceToastProps) {
  const latest = events[events.length - 1];

  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(() => onDismiss(latest.userId), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [latest, onDismiss]);

  if (!latest) return null;

  const member = members.find((m) => m.userId === latest.userId);
  const name = member?.displayName ?? member?.username ?? "Someone";

  return (
    <div
      key={latest.id}
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-3 left-3 z-10 animate-[fadeInOut_3s_ease-in-out] rounded-lg border border-border bg-background-3 px-3 py-1.5 text-xs text-foreground shadow-sm"
    >
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />
      {name} is now online
    </div>
  );
}
