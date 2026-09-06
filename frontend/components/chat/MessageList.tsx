"use client";

import { useLayoutEffect, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { MessageItem } from "./MessageItem";
import { DayDivider } from "./DayDivider";
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
  if (a.senderType !== b.senderType) return false;
  if (a.senderType === "system") return false;
  if (a.userId !== b.userId) return false;
  if (a.deletedAt || b.deletedAt) return false;
  const gapMs = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return gapMs < 5 * 60 * 1000;
}

function githubRailPosition(messages: Message[], index: number): "none" | "start" | "middle" {
  const current = messages[index];
  if (current.senderType !== "system") return "none";

  const hasEarlierSystemMessage = messages.slice(0, index).some((m) => m.senderType === "system");
  return hasEarlierSystemMessage ? "middle" : "start";
}

function isDifferentCalendarDay(a: string, b: string): boolean {
  const dateA = new Date(a);
  const dateB = new Date(b);
  return (
    dateA.getFullYear() !== dateB.getFullYear() ||
    dateA.getMonth() !== dateB.getMonth() ||
    dateA.getDate() !== dateB.getDate()
  );
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
        const showDayDivider = !previous || isDifferentCalendarDay(previous.createdAt, message.createdAt);
        const isGrouped = previous && !showDayDivider ? isSameSenderGroup(previous, message) : false;
        const railPosition = githubRailPosition(messages, index);

        return (
          <div key={message.id}>
            {showDayDivider && <DayDivider iso={message.createdAt} />}
            <MessageItem
              message={message}
              sender={message.userId ? membersById.get(message.userId) : undefined}
              isOwnMessage={message.userId !== null && message.userId === currentUserId}
              isGroupedWithPrevious={isGrouped}
              railPosition={railPosition}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        );
      })}
    </div>
  );
}
