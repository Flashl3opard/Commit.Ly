"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { RepositoryPicker } from "./RepositoryPicker";
import { createRoom, type Room } from "@/lib/api/rooms";
import { ApiError } from "@/lib/api/types";
import type { GithubAppRepository } from "@/lib/api/github";

type CreateRoomDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (room: Room) => void;
};

const MIN_PASSWORD_LENGTH = 6;

function errorMessageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You do not have access to this repository.";
    if (err.status === 404) return "That repository could not be found.";
    if (err.status === 409) return "A room already exists for this repository.";
    if (err.status === 401) return "Your session has expired. Please log in again.";
    if (err.status === 400) return "Please check the room details and try again.";
    return err.message;
  }
  return "Something went wrong. Please try again.";
}

export function CreateRoomDialog({ open, onClose, onCreated }: CreateRoomDialogProps) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GithubAppRepository | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetAndClose() {
    setName("");
    setPassword("");
    setSelectedRepo(null);
    setError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Room name is required.");
      return;
    }
    if (!selectedRepo) {
      setError("Select a repository for this room.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      const { room } = await createRoom({
        name: name.trim(),
        githubRepositoryId: selectedRepo.id,
        password,
      });
      setPassword("");
      onCreated(room);
      resetAndClose();
    } catch (err) {
      setError(errorMessageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={resetAndClose}
      title="Create a room"
      description="A room is a workspace tied to one GitHub repository."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="room-name" className="text-xs font-medium tracking-wide text-muted-2 uppercase">
            Room name
          </label>
          <input
            id="room-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            placeholder="Development"
            className="focus-ring mt-1.5 w-full rounded-lg border border-border-strong bg-background-2 px-3.5 py-2 text-sm text-foreground placeholder:text-muted-2"
          />
        </div>

        <div>
          <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">Select repository</p>
          <div className="mt-1.5">
            <RepositoryPicker selectedId={selectedRepo?.id ?? null} onSelect={setSelectedRepo} />
          </div>
        </div>

        <div>
          <label htmlFor="room-password" className="text-xs font-medium tracking-wide text-muted-2 uppercase">
            Room password
          </label>
          <input
            id="room-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={128}
            placeholder="Choose a password for teammates to join"
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
            {submitting ? "Creating room…" : "Create room"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
