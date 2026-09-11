"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { DmMessage } from "@/lib/api/dm";
import type { UserSearchResult } from "@/lib/api/users";

const MAX_CONTENT_LENGTH = 4000;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

type DmMessageBubbleProps = {
  message: DmMessage;
  sender: UserSearchResult;
  isOwnMessage: boolean;
  isGroupedWithPrevious: boolean;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
};

export function DmMessageBubble({ message, sender, isOwnMessage, isGroupedWithPrevious, onEdit, onDelete }: DmMessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDeleted = message.deletedAt !== null;
  const senderName = sender.displayName ?? sender.username;

  async function handleSaveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content) {
      setIsEditing(false);
      setDraft(message.content ?? "");
      return;
    }

    setSaving(true);
    setActionError(null);
    try {
      await onEdit(message.id, trimmed);
      setIsEditing(false);
    } catch {
      setActionError("Couldn't save your edit. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setDraft(message.content ?? "");
    setActionError(null);
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      await onDelete(message.id);
    } catch {
      setActionError("Couldn't delete this message. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className={`group flex items-start gap-3 px-4 py-1 hover-surface-weakest ${isGroupedWithPrevious ? "" : "mt-3"}`}>
      {!isGroupedWithPrevious ? (
        <UserAvatar avatarUrl={sender.avatarUrl} username={sender.username} size="sm" className="mt-0.5" />
      ) : (
        <div className="w-7 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        {!isGroupedWithPrevious && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">{senderName}</span>
            <span className="text-[11px] text-muted-2">{formatTimestamp(message.createdAt)}</span>
          </div>
        )}

        {isDeleted ? (
          <p className="text-sm italic text-muted-2">This message was deleted.</p>
        ) : isEditing ? (
          <div className="mt-1 flex flex-col gap-1.5">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={MAX_CONTENT_LENGTH}
              rows={2}
              autoFocus
              className="w-full resize-none rounded-lg border border-border-strong bg-background-2 px-2.5 py-1.5 text-sm text-foreground focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="focus-ring flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />}
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="focus-ring flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover-surface"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm whitespace-pre-wrap text-foreground">{message.content}</p>
        )}

        {actionError && <p className="mt-1 text-xs text-danger">{actionError}</p>}
      </div>

      {isOwnMessage && !isDeleted && !isEditing && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            title="Edit message"
            aria-label="Edit message"
            className="focus-ring rounded-md p-1.5 text-muted-2 hover-surface hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {confirmingDelete ? (
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              title="Confirm delete"
              aria-label="Confirm delete"
              className="focus-ring rounded-md p-1.5 text-danger hover:bg-danger-bg"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              title="Delete message"
              aria-label="Delete message"
              className="focus-ring rounded-md p-1.5 text-muted-2 hover:bg-danger-bg hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
