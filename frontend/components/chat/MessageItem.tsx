"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X, Loader2, Copy, Smile, Reply, MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoomOwnerMark } from "@/components/ui/RoomOwnerMark";
import { GithubActivityCard } from "./activity/GithubActivityCard";
import { renderMessageContent } from "./mentionRendering";
import type { Message } from "@/lib/api/chat";
import type { RoomMember } from "@/lib/api/rooms";

const MAX_CONTENT_LENGTH = 4000;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

type MessageItemProps = {
  message: Message;
  sender: RoomMember | undefined;
  members: RoomMember[];
  isOwnMessage: boolean;
  isGroupedWithPrevious: boolean;
  railPosition: "none" | "start" | "middle";
  onOpenThread?: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
};

export function MessageItem({
  message,
  sender,
  members,
  isOwnMessage,
  isGroupedWithPrevious,
  railPosition,
  onOpenThread,
  onEdit,
  onDelete,
}: MessageItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isDeleted = message.deletedAt !== null;
  const senderName = sender?.displayName ?? sender?.username ?? "Unknown user";

  if (message.senderType === "system") {
    return <GithubActivityCard message={message} railPosition={railPosition} />;
  }

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
    setActionError(null);
    try {
      await onDelete(message.id);
    } catch {
      setActionError("Couldn't delete this message. Please try again.");
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  if (isDeleted) {
    return (
      <div className={`group flex gap-3 px-4 py-1 ${isGroupedWithPrevious ? "" : "mt-2"}`}>
        <div className="w-8 shrink-0" />
        <p className="text-sm italic text-muted-2">This message was deleted.</p>
      </div>
    );
  }

  return (
    <div className={`group relative flex gap-3 px-4 py-1 ${isGroupedWithPrevious ? "" : "mt-2"}`}>
      <div className="w-8 shrink-0">
        {!isGroupedWithPrevious && <UserAvatar avatarUrl={sender?.avatarUrl ?? null} username={senderName} size="sm" />}
      </div>

      <div className="min-w-0 flex-1">
        {!isGroupedWithPrevious && (
          <div className="flex items-baseline gap-2">
            <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
              {senderName}
              {sender?.role === "OWNER" && <RoomOwnerMark />}
            </span>
            <span className="text-xs text-muted-2">{formatTimestamp(message.createdAt)}</span>
          </div>
        )}

        {isEditing ? (
          <div className="mt-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                } else if (e.key === "Escape") {
                  handleCancelEdit();
                }
              }}
              maxLength={MAX_CONTENT_LENGTH}
              autoFocus
              rows={1}
              className="focus-ring w-full resize-none rounded-lg border border-border-strong bg-background-2 px-3 py-1.5 text-sm text-foreground"
            />
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                className="focus-ring inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />}
                Save
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={saving}
                className="focus-ring inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-muted hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Cancel
              </button>
              <span className="text-xs text-muted-2">Enter to save, Shift+Enter for a newline</span>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {message.content ? renderMessageContent(message.content, message.mentionedUserIds, members) : null}
            {message.editedAt && <span className="ml-1.5 text-xs text-muted-2">(edited)</span>}
          </p>
        )}

        {actionError && <p className="mt-1 text-xs text-danger">{actionError}</p>}

        {!message.parentMessageId && message.replyCount > 0 && onOpenThread && (
          <button
            type="button"
            onClick={() => onOpenThread(message.id)}
            className="focus-ring mt-1 flex items-center gap-1.5 rounded-md py-0.5 text-xs font-medium text-accent hover:underline"
          >
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>

      {!isEditing && (
        <div className="absolute -top-3 right-4 hidden items-center gap-0.5 rounded-lg border border-border bg-background-3 px-1 py-1 opacity-0 shadow-sm transition-opacity group-hover:flex group-hover:opacity-100">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(message.content ?? "")}
            title="Copy text"
            aria-label="Copy message text"
            className="focus-ring rounded-md p-1.5 text-muted-2 hover:bg-background-2 hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Reactions are coming soon"
            aria-label="Reactions are coming soon"
            disabled
            className="rounded-md p-1.5 text-muted-2 opacity-50"
          >
            <Smile className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Reply in thread"
            aria-label="Reply in thread"
            onClick={onOpenThread ? () => onOpenThread(message.id) : undefined}
            disabled={!onOpenThread}
            className="focus-ring rounded-md p-1.5 text-muted-2 hover:bg-background-2 hover:text-foreground disabled:opacity-50"
          >
            <Reply className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          {isOwnMessage &&
            (confirmingDelete ? (
              <>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  title="Confirm delete"
                  aria-label="Confirm delete"
                  className="focus-ring rounded-md p-1.5 text-danger hover:bg-danger-bg disabled:opacity-60"
                >
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  title="Cancel"
                  aria-label="Cancel delete"
                  className="focus-ring rounded-md p-1.5 text-muted-2 hover:bg-background-2 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  title="Edit message"
                  aria-label="Edit message"
                  className="focus-ring rounded-md p-1.5 text-muted-2 hover:bg-background-2 hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  title="Delete message"
                  aria-label="Delete message"
                  className="focus-ring rounded-md p-1.5 text-muted-2 hover:bg-danger-bg hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </>
            ))}
        </div>
      )}
    </div>
  );
}
