"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, LogOut, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { leaveRoom, deleteRoom, type RoomDetails } from "@/lib/api/rooms";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { ApiError } from "@/lib/api/types";

type RoomSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  room: RoomDetails;
};

type ConfirmStep = "none" | "leave" | "delete";

export function RoomSettingsDialog({ open, onClose, room }: RoomSettingsDialogProps) {
  const [confirmStep, setConfirmStep] = useState<ConfirmStep>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const { removeRoom, rooms } = useRooms();
  const router = useRouter();

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(room.roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (permissions, insecure context) —
      // the code is still visible on screen to copy manually, so this is
      // a silent no-op rather than an error state.
    }
  }

  function handleClose() {
    setConfirmStep("none");
    setError(null);
    onClose();
  }

  async function handleLeave() {
    setSubmitting(true);
    setError(null);
    try {
      await leaveRoom(room.id);
      removeRoom(room.id);
      navigateAfterRemoval();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      await deleteRoom(room.id);
      removeRoom(room.id);
      navigateAfterRemoval();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  function navigateAfterRemoval() {
    const remaining = rooms.filter((r) => r.id !== room.id);
    handleClose();
    router.push(remaining.length > 0 ? `/rooms/${remaining[0].id}` : "/rooms");
  }

  if (confirmStep === "delete") {
    return (
      <Dialog open={open} onClose={handleClose} title={`Delete "${room.name}"?`}>
        <div className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-bg p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
          <p className="text-sm text-danger">
            This permanently removes the Commit.ly room. Your GitHub repository will NOT be deleted.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmStep("none")}
            disabled={submitting}
            className="focus-ring rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Deleting…" : "Delete room"}
          </button>
        </div>
      </Dialog>
    );
  }

  if (confirmStep === "leave") {
    return (
      <Dialog open={open} onClose={handleClose} title={`Leave "${room.name}"?`}>
        <p className="text-sm text-muted">You&apos;ll need the room code again to rejoin.</p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmStep("none")}
            disabled={submitting}
            className="focus-ring rounded-lg px-4 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLeave}
            disabled={submitting}
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-semibold text-foreground transition-colors hover-surface disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Leaving…" : "Leave room"}
          </button>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Room settings">
      <div className="rounded-xl border border-border bg-background-2 p-4">
        <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">Room code</p>
        <p className="mt-1 text-sm text-muted">Share this code so teammates can join &quot;{room.name}&quot;.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex-1 rounded-lg border border-border-strong bg-background-3 px-3.5 py-2 text-center font-mono text-lg tracking-[0.3em] text-foreground">
            {room.roomCode}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            title="Copy room code"
            aria-label="Copy room code"
            className="focus-ring inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-border-strong px-3 text-sm font-medium text-foreground transition-colors hover-surface"
          >
            {codeCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {room.currentUserRole === "MEMBER" && (
          <button
            type="button"
            onClick={() => setConfirmStep("leave")}
            className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover-surface"
          >
            <LogOut className="h-4 w-4 text-muted-2" aria-hidden="true" />
            Leave room
          </button>
        )}
        {room.currentUserRole === "OWNER" && (
          <button
            type="button"
            onClick={() => setConfirmStep("delete")}
            className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-bg"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete room
          </button>
        )}
      </div>
    </Dialog>
  );
}
