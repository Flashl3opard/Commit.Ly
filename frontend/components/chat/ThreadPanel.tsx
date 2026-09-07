"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { Composer } from "./Composer";
import { getThreadReplies, sendReply, editMessage, deleteMessage, type Message } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/types";
import type { RoomMember } from "@/lib/api/rooms";

type ThreadPanelProps = {
  roomId: string;
  parentMessage: Message;
  sender: RoomMember | undefined;
  members: RoomMember[];
  currentUserId: string;
  onThreadEvent: (parentMessageId: string, handler: (message: Message) => void) => () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
  onClose: () => void;
};

/**
 * Real threaded replies: fetches the existing reply list on open, appends
 * new replies as they arrive over the same WebSocket connection the main
 * room uses (via onThreadEvent, scoped to this parent message's id), and
 * lets the user send/edit/delete replies through the same REST + broadcast
 * machinery as top-level messages.
 */
type LoadState =
  | { status: "loading"; parentMessageId: string }
  | { status: "ready"; parentMessageId: string; replies: Message[] }
  | { status: "error"; parentMessageId: string; message: string };

export function ThreadPanel({
  roomId,
  parentMessage,
  sender,
  members,
  currentUserId,
  onThreadEvent,
  onTypingStart,
  onTypingStop,
  onClose,
}: ThreadPanelProps) {
  const [load, setLoad] = useState<LoadState>({ status: "loading", parentMessageId: parentMessage.id });

  // A render for a parentMessageId that doesn't match the in-flight/loaded
  // state (the user switched threads while this was still resolving) is
  // treated as "loading" rather than showing the previous thread's replies
  // — same pattern as the room page's own load-state handling.
  const current = load.parentMessageId === parentMessage.id ? load : { status: "loading" as const, parentMessageId: parentMessage.id };

  useEffect(() => {
    let cancelled = false;

    getThreadReplies(roomId, parentMessage.id)
      .then(({ messages }) => {
        if (!cancelled) setLoad({ status: "ready", parentMessageId: parentMessage.id, replies: messages });
      })
      .catch((err) => {
        if (!cancelled) {
          setLoad({
            status: "error",
            parentMessageId: parentMessage.id,
            message: err instanceof ApiError ? err.message : "Couldn't load replies. Please try again.",
          });
        }
      });

    const unsubscribe = onThreadEvent(parentMessage.id, (message) => {
      setLoad((prev) => {
        if (prev.status !== "ready" || prev.parentMessageId !== parentMessage.id) return prev;
        const index = prev.replies.findIndex((r) => r.id === message.id);
        const replies =
          index === -1
            ? [...prev.replies, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            : prev.replies.map((r) => (r.id === message.id ? message : r));
        return { ...prev, replies };
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomId, parentMessage.id, onThreadEvent]);

function upsertReply(prev: LoadState, message: Message): LoadState {
    if (prev.status !== "ready") return prev;
    const index = prev.replies.findIndex((r) => r.id === message.id);
    const replies = index === -1 ? [...prev.replies, message] : prev.replies.map((r) => (r.id === message.id ? message : r));
    return { ...prev, replies };
  }

  async function handleSendReply(content: string) {
    const { message } = await sendReply(roomId, parentMessage.id, content);
    setLoad((prev) => upsertReply(prev, message));
  }

  async function handleEditReply(messageId: string, content: string) {
    const { message } = await editMessage(messageId, content);
    setLoad((prev) => upsertReply(prev, message));
  }

  async function handleDeleteReply(messageId: string) {
    const { message } = await deleteMessage(messageId);
    setLoad((prev) => upsertReply(prev, message));
  }

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-l border-border bg-room-panel-bg md:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Thread</h2>
        <button
          type="button"
          onClick={onClose}
          title="Close thread"
          aria-label="Close thread"
          className="focus-ring rounded-lg p-1.5 text-muted-2 hover:bg-background-3 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <MessageItem
          message={parentMessage}
          sender={sender}
          members={members}
          isOwnMessage={parentMessage.userId === currentUserId}
          isGroupedWithPrevious={false}
          railPosition="none"
          onEdit={handleEditReply}
          onDelete={handleDeleteReply}
        />
        <div className="mx-4 my-3 border-t border-border" />

        {current.status === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading replies…
          </div>
        ) : current.status === "error" ? (
          <p className="px-4 py-6 text-center text-sm text-danger">{current.message}</p>
        ) : current.replies.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">No replies yet — start the thread below.</p>
        ) : (
          current.replies.map((reply, index) => {
            const replySender = reply.userId ? members.find((m) => m.userId === reply.userId) : undefined;
            const previous = index > 0 ? current.replies[index - 1] : null;
            const isGrouped =
              previous !== null &&
              previous.userId === reply.userId &&
              !previous.deletedAt &&
              !reply.deletedAt &&
              new Date(reply.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60 * 1000;

            return (
              <MessageItem
                key={reply.id}
                message={reply}
                sender={replySender}
                members={members}
                isOwnMessage={reply.userId === currentUserId}
                isGroupedWithPrevious={isGrouped}
                railPosition="none"
                onEdit={handleEditReply}
                onDelete={handleDeleteReply}
              />
            );
          })
        )}
      </div>

      <Composer
        onSend={handleSendReply}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        members={members}
        placeholder="Reply in thread…"
      />
    </div>
  );
}
