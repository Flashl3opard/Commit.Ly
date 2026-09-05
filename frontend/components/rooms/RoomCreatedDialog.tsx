"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import type { Room } from "@/lib/api/rooms";

type RoomCreatedDialogProps = {
  room: Room | null;
  onClose: () => void;
};

export function RoomCreatedDialog({ room, onClose }: RoomCreatedDialogProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser; the code is still
      // visible on screen for the user to copy manually.
    }
  }

  return (
    <Dialog open={room !== null} onClose={onClose} title="Room created">
      {room && (
        <div>
          <p className="text-lg font-semibold text-foreground">{room.name}</p>
          <p className="mt-0.5 text-sm text-muted">{room.repository.fullName}</p>

          <div className="mt-5 rounded-lg border border-border-strong bg-background-2 px-4 py-4 text-center">
            <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">Room code</p>
            <p className="mt-1.5 font-mono text-3xl font-semibold tracking-[0.2em] text-accent">
              {room.roomCode}
            </p>
          </div>

          <p className="mt-3 text-sm text-muted">Share this code with teammates so they can join.</p>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              aria-live="polite"
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-accent" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  Copy code
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
