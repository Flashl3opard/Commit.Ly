"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useChatRoom } from "@/lib/chat/useChatRoom";
import { ActiveRoomMessagesProvider } from "@/lib/rooms/ActiveRoomMessagesContext";
import { sendMessage, editMessage, deleteMessage } from "@/lib/api/chat";
import { RoomMembersPanel } from "@/components/rooms/RoomMembersPanel";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { TypingIndicator } from "./TypingIndicator";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { NewMessagesButton } from "./NewMessagesButton";
import { ThreadPanel } from "./ThreadPanel";
import { PresenceToast } from "./PresenceToast";
import { CommitlyMark } from "@/components/ui/CommitlyMark";
import { Drawer } from "@/components/layout/Drawer";
import { Loader2 } from "lucide-react";
import type { RoomDetails } from "@/lib/api/rooms";

/**
 * Owns the single useChatRoom() call for this room and renders both the
 * message area and the members panel from it, so presence (owned by the
 * chat hook) can be layered onto RoomMembersPanel (owned by room data)
 * without either component needing to know about the other's state
 * directly, and without a second WebSocket-derived state tree.
 */
export function RoomChat({
  room,
  membersOpen,
  onCloseMembers,
}: {
  room: RoomDetails;
  membersOpen: boolean;
  onCloseMembers: () => void;
}) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const chat = useChatRoom(room.id, currentUserId);
  const [scrollToBottomSignal, setScrollToBottomSignal] = useState(0);
  const [openThreadMessageId, setOpenThreadMessageId] = useState<string | null>(null);

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
    <ActiveRoomMessagesProvider value={{ roomId: room.id, messageIds: chat.messages.map((m) => m.id) }}>
      <div className="bg-chat relative flex min-h-0 flex-1 flex-col">
        {chat.connectionState !== "connected" && (
          <div className="absolute top-2 left-1/2 z-10 -translate-x-1/2">
            <ConnectionStatusBadge state={chat.connectionState} />
          </div>
        )}

        <PresenceToast
          events={chat.recentPresenceEvents}
          members={room.members}
          onDismiss={(userId) => chat.dismissPresenceToast(userId)}
        />

        {chat.loadingInitial ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading messages…
            </div>
          </div>
        ) : chat.loadError && chat.messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <CommitlyMark className="h-10 w-10 opacity-40 grayscale" />
            <p className="mt-3 text-sm text-muted">{chat.loadError}</p>
          </div>
        ) : chat.messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 -z-10 scale-150 opacity-20 blur-2xl" aria-hidden="true">
                <CommitlyMark className="h-16 w-16" />
              </div>
              <CommitlyMark className="h-10 w-10" />
            </div>
            <h2 className="mt-4 text-base font-semibold text-foreground">Welcome to {room.name}</h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted">
              This is the beginning of the conversation for this repository.
            </p>
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
            onOpenThread={setOpenThreadMessageId}
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

      <div className="hidden min-h-0 lg:flex">
        {!openThreadMessageId && <RoomMembersPanel members={room.members} onlineUserIds={chat.onlineUserIds} />}
        {openThreadMessageId &&
          (() => {
            const parentMessage = chat.messages.find((m) => m.id === openThreadMessageId);
            if (!parentMessage) return null;
            const sender = parentMessage.userId ? room.members.find((m) => m.userId === parentMessage.userId) : undefined;
            return <ThreadPanel parentMessage={parentMessage} sender={sender} onClose={() => setOpenThreadMessageId(null)} />;
          })()}
      </div>

      <div className="lg:hidden">
        <Drawer
          side="right"
          open={openThreadMessageId !== null || membersOpen}
          onClose={openThreadMessageId ? () => setOpenThreadMessageId(null) : onCloseMembers}
        >
          {openThreadMessageId ? (
            (() => {
              const parentMessage = chat.messages.find((m) => m.id === openThreadMessageId);
              if (!parentMessage) return null;
              const sender = parentMessage.userId ? room.members.find((m) => m.userId === parentMessage.userId) : undefined;
              return <ThreadPanel parentMessage={parentMessage} sender={sender} onClose={() => setOpenThreadMessageId(null)} />;
            })()
          ) : (
            <RoomMembersPanel members={room.members} onlineUserIds={chat.onlineUserIds} />
          )}
        </Drawer>
      </div>
    </ActiveRoomMessagesProvider>
  );
}
