"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { joinRoom, type Room } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";

type JoinRoomDialogProps = {
  open: boolean;
  onClose: () => void;
  onJoined: (room: Room) => void;
};

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 404) return "No room found with that code.";
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

export function JoinRoomDialog({ open, onClose, onJoined }: JoinRoomDialogProps) {
  const [roomCode, setRoomCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setRoomCode("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!/^\d{6}$/.test(roomCode)) {
      setError("Room code must be exactly 6 digits.");
      return;
    }

    setSubmitting(true);
    try {
      const { room } = await joinRoom({ roomCode });
      onJoined(room);
      resetAndClose();
    } catch (err) {
      setError(errorMessageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={resetAndClose} title="Join a room">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="join-room-code" className="text-xs font-medium tracking-wide text-muted-2 uppercase">
            Room code
          </label>
          <input
            id="join-room-code"
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={6}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="focus-ring mt-1.5 w-full rounded-lg border border-border-strong bg-background-2 px-3.5 py-2 text-center font-mono text-lg tracking-[0.3em] text-foreground placeholder:text-muted-2"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={resetAndClose}
            className="focus-ring rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Joining…" : "Join room"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
