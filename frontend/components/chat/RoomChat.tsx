"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useChatRoom } from "@/lib/chat/useChatRoom";
import { sendMessage, editMessage, deleteMessage } from "@/lib/api/chat";
import { RoomMembersPanel } from "@/components/rooms/RoomMembersPanel";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { TypingIndicator } from "./TypingIndicator";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { NewMessagesButton } from "./NewMessagesButton";
import { Loader2, MessageSquare, AlertCircle } from "lucide-react";
import type { RoomDetails } from "@/lib/api/rooms";

/**
 * Owns the single useChatRoom() call for this room and renders both the
 * message area and the members panel from it, so presence (owned by the
 * chat hook) can be layered onto RoomMembersPanel (owned by room data)
 * without either component needing to know about the other's state
 * directly, and without a second WebSocket-derived state tree.
 */
export function RoomChat({ room }: { room: RoomDetails }) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const chat = useChatRoom(room.id, currentUserId);
  const [scrollToBottomSignal, setScrollToBottomSignal] = useState(0);

  const handleSend = useCallback(
    async (content: string) => {
      const { message } = await sendMessage(room.id, content);
      chat.upsertLocalMessage(message);
    },
    [room.id, chat],
  );

  const handleEdit = useCallback(
    async (messageId: string, content: string) => {
      const { message } = await editMessage(messageId, content);
      chat.upsertLocalMessage(message);
    },
    [chat],
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      const { message } = await deleteMessage(messageId);
      chat.upsertLocalMessage(message);
    },
    [chat],
  );

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {chat.connectionState !== "connected" && (
          <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
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
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-2" aria-hidden="true" />
            <p className="mt-3 text-sm text-muted">{chat.loadError}</p>
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <MessageSquare className="h-8 w-8 text-muted-2" aria-hidden="true" />
            <h2 className="mt-3 text-base font-semibold text-foreground">No messages yet.</h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted">Say hello to get the conversation started.</p>
          </div>
        ) : (
          <MessageList
            messages={chat.messages}
            members={room.members}
            currentUserId={currentUserId ?? ""}
            loadingOlder={chat.loadingOlder}
            hasMoreOlder={chat.hasMoreOlder}
            onLoadOlder={chat.loadOlderMessages}
            onScrollPositionChange={chat.notifyScrollPosition}
            onEdit={handleEdit}
            onDelete={handleDelete}
            scrollToBottomSignal={scrollToBottomSignal}
          />
        )}

        {chat.hasNewMessagesBelow && (
          <NewMessagesButton
            onClick={() => {
              chat.notifyScrollPosition(true);
              setScrollToBottomSignal((n) => n + 1);
            }}
          />
        )}

        <TypingIndicator typingUserIds={chat.typingUserIds} members={room.members} />

        <Composer
          onSend={handleSend}
          onTypingStart={chat.sendTypingStart}
          onTypingStop={chat.sendTypingStop}
          disabled={chat.connectionState === "disconnected"}
        />
      </div>

      <RoomMembersPanel members={room.members} onlineUserIds={chat.onlineUserIds} />
    </>
  );
}
