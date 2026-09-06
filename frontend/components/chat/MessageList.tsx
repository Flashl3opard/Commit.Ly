"use client";

import { useLayoutEffect, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { MessageItem } from "./MessageItem";
import type { Message } from "@/lib/api/chat";
import type { RoomMember } from "@/lib/api/rooms";

const NEAR_BOTTOM_THRESHOLD_PX = 120;
const NEAR_TOP_THRESHOLD_PX = 80;

type MessageListProps = {
  messages: Message[];
  members: RoomMember[];
  currentUserId: string;
  loadingOlder: boolean;
  hasMoreOlder: boolean;
  onLoadOlder: () => void;
  onScrollPositionChange: (isNearBottom: boolean) => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => Promise<void>;
  /** Bumped by the parent (e.g. clicking "New messages") to trigger a scroll-to-bottom. */
  scrollToBottomSignal?: number;
};

function isSameSenderGroup(a: Message, b: Message): boolean {
  if (a.userId !== b.userId) return false;
  if (a.deletedAt || b.deletedAt) return false;
  const gapMs = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return gapMs < 5 * 60 * 1000;
}

export function MessageList({
  messages,
  members,
  currentUserId,
  loadingOlder,
  hasMoreOlder,
  onLoadOlder,
  onScrollPositionChange,
  onEdit,
  onDelete,
  scrollToBottomSignal,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeightRef = useRef<number | null>(null);
  const previousMessageCountRef = useRef(0);
  const hasScrolledToBottomOnceRef = useRef(false);

  // Preserve scroll position when older messages are prepended: capture the
  // scroll height before the DOM updates, then restore the same visual
  // offset after — otherwise prepending content shoves the viewport down
  // and the user loses their place.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (previousScrollHeightRef.current !== null) {
      const heightDelta = container.scrollHeight - previousScrollHeightRef.current;
      container.scrollTop += heightDelta;
      previousScrollHeightRef.current = null;
      return;
    }

    if (!hasScrolledToBottomOnceRef.current && messages.length > 0) {
      container.scrollTop = container.scrollHeight;
      hasScrolledToBottomOnceRef.current = true;
    }

    previousMessageCountRef.current = messages.length;
  }, [messages]);

  useEffect(() => {
    if (scrollToBottomSignal === undefined) return;
    const container = containerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
    // Only re-runs when the signal itself changes, not on every message
    // list update — this effect is purely for the explicit "jump to
    // bottom" action, not the auto-scroll-on-first-load handled above.
  }, [scrollToBottomSignal]);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    onScrollPositionChange(distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX);

    if (container.scrollTop < NEAR_TOP_THRESHOLD_PX && hasMoreOlder && !loadingOlder) {
      previousScrollHeightRef.current = container.scrollHeight;
      onLoadOlder();
    }
  }

  const membersById = new Map(members.map((m) => [m.userId, m]));

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto py-3">
      {hasMoreOlder && (
        <div className="flex justify-center py-2">
          {loadingOlder && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-2">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Loading earlier messages…
            </span>
          )}
        </div>
      )}

      {messages.map((message, index) => {
        const previous = index > 0 ? messages[index - 1] : null;
        const isGrouped = previous ? isSameSenderGroup(previous, message) : false;
        return (
          <MessageItem
            key={message.id}
            message={message}
            sender={membersById.get(message.userId)}
            isOwnMessage={message.userId === currentUserId}
            isGroupedWithPrevious={isGrouped}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        );
      })}
    </div>
  );
}
