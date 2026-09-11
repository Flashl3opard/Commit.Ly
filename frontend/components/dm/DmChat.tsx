"use client";

import { useCallback, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDmConversation } from "@/lib/chat/useDmConversation";
import { sendDmMessage, editDmMessage, deleteDmMessage } from "@/lib/api/dm";
import { DmMessageBubble } from "./DmMessageBubble";
import { DmComposer } from "./DmComposer";
import { ConnectionStatusBadge } from "@/components/chat/ConnectionStatusBadge";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ErrorState } from "@/components/ui/ErrorState";
import type { UserSearchResult } from "@/lib/api/users";

const GROUPING_WINDOW_MS = 5 * 60 * 1000;

export function DmChat({ conversationId, otherUser }: { conversationId: string; otherUser: UserSearchResult }) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const chat = useDmConversation(conversationId, currentUserId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (chat.messages.length > previousMessageCount.current) {
      el.scrollTop = el.scrollHeight;
    }
    previousMessageCount.current = chat.messages.length;
  }, [chat.messages.length]);

  const handleSend = useCallback(
    async (content: string) => {
      const { message } = await sendDmMessage(conversationId, content);
      chat.upsertLocalMessage(message);
    },
    [conversationId, chat],
  );

  const handleEdit = useCallback(
    async (messageId: string, content: string) => {
      const { message } = await editDmMessage(messageId, content);
      chat.upsertLocalMessage(message);
    },
    [chat],
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      const { message } = await deleteDmMessage(messageId);
      chat.upsertLocalMessage(message);
    },
    [chat],
  );

  const isOtherUserTyping = chat.typingUserIds.has(otherUser.id);

  return (
    <div className="bg-chat relative flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <UserAvatar avatarUrl={otherUser.avatarUrl} username={otherUser.username} size="sm" />
        <span className="text-sm font-semibold text-foreground">{otherUser.displayName ?? otherUser.username}</span>
      </header>

      {chat.connectionState !== "connected" && (
        <div className="absolute top-14 left-1/2 z-10 -translate-x-1/2">
          <ConnectionStatusBadge state={chat.connectionState} />
        </div>
      )}

      {chat.loadingInitial ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading messages…
          </div>
        </div>
      ) : chat.loadError && chat.messages.length === 0 ? (
        <ErrorState title="Couldn't load messages" description={chat.loadError} onRetry={() => window.location.reload()} />
      ) : chat.messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <UserAvatar avatarUrl={otherUser.avatarUrl} username={otherUser.username} size="lg" />
          <h2 className="mt-4 text-base font-semibold text-foreground">{otherUser.displayName ?? otherUser.username}</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            This is the start of your conversation with {otherUser.displayName ?? otherUser.username}.
          </p>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
          {chat.hasMoreOlder && (
            <div className="flex justify-center py-2">
              <button
                type="button"
                onClick={chat.loadOlderMessages}
                disabled={chat.loadingOlder}
                className="focus-ring rounded-md px-3 py-1 text-xs text-muted hover-surface"
              >
                {chat.loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )}
          {chat.messages.map((message, index) => {
            const previous = chat.messages[index - 1];
            const isGroupedWithPrevious =
              Boolean(previous) &&
              previous.senderId === message.senderId &&
              new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < GROUPING_WINDOW_MS;
            const isOwnMessage = message.senderId === currentUserId;
            const sender = isOwnMessage
              ? { id: currentUserId ?? "", username: user?.username ?? "You", displayName: user?.displayName ?? null, avatarUrl: user?.avatarUrl ?? null }
              : otherUser;

            return (
              <DmMessageBubble
                key={message.id}
                message={message}
                sender={sender}
                isOwnMessage={isOwnMessage}
                isGroupedWithPrevious={isGroupedWithPrevious}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      <div className="h-5 px-4 text-xs text-muted-2" role="status" aria-live="polite">
        {isOtherUserTyping && (
          <span className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-muted-2 [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-muted-2 [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-muted-2" />
            </span>
            {otherUser.displayName ?? otherUser.username} is typing
          </span>
        )}
      </div>

      <DmComposer
        onSend={handleSend}
        onTypingStart={chat.sendTypingStart}
        onTypingStop={chat.sendTypingStop}
        placeholder={`Message ${otherUser.displayName ?? otherUser.username}…`}
        disabled={chat.connectionState === "disconnected"}
      />
    </div>
  );
}
