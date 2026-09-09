"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { createChannel, type Channel } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";

type CreateChannelDialogProps = {
  open: boolean;
  roomId: string;
  onClose: () => void;
  onCreated: (channel: Channel) => void;
};

const CHANNEL_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) return "A channel with this name already exists in this room.";
    if (err.status === 403) return "Only the room owner can create channels.";
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

export function CreateChannelDialog({ open, roomId, onClose, onCreated }: CreateChannelDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setName("");
    setDescription("");
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim().toLowerCase();
    if (!trimmed) {
      setError("Channel name is required.");
      return;
    }
    if (!CHANNEL_NAME_PATTERN.test(trimmed)) {
      setError("Channel name must be lowercase letters, numbers, and hyphens only.");
      return;
    }

    setSubmitting(true);
    try {
      const { channel } = await createChannel(roomId, {
        name: trimmed,
        description: description.trim() || undefined,
      });
      onCreated(channel);
      resetAndClose();
    } catch (err) {
      setError(errorMessageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={resetAndClose} title="Create channel" description="Channels organize conversation within this room.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="channel-name" className="text-xs font-medium tracking-wide text-muted-2 uppercase">
            Channel name
          </label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm text-muted-2">#</span>
            <input
              id="channel-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={32}
              placeholder="frontend"
              className="focus-ring w-full rounded-lg border border-border-strong bg-background-2 py-2 pr-3.5 pl-7 text-sm text-foreground placeholder:text-muted-2"
            />
          </div>
        </div>

        <div>
          <label htmlFor="channel-description" className="text-xs font-medium tracking-wide text-muted-2 uppercase">
            Description <span className="normal-case text-muted-2">(optional)</span>
          </label>
          <input
            id="channel-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={280}
            placeholder="What's this channel for?"
            className="focus-ring mt-1.5 w-full rounded-lg border border-border-strong bg-background-2 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-2"
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
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
