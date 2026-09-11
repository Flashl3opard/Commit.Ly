"use client";

import { Users } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { DmConversationSummary } from "@/lib/api/dm";
import type { UserSearchResult } from "@/lib/api/users";

function formatPreviewTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationList({
  conversations,
  profilesById,
  activeConversationId,
  onSelectConversation,
  onOpenFriends,
}: {
  conversations: DmConversationSummary[];
  profilesById: Map<string, UserSearchResult>;
  activeConversationId: string | null;
  onSelectConversation: (conversation: DmConversationSummary) => void;
  onOpenFriends: () => void;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-border bg-room-sidebar-bg">
      <div className="flex items-center justify-between border-b border-room-sidebar-active px-3 py-3">
        <h2 className="text-sm font-semibold text-room-sidebar-fg">Direct Messages</h2>
        <button
          type="button"
          onClick={onOpenFriends}
          title="Friends"
          aria-label="Manage friends"
          className="focus-ring rounded-lg p-1.5 text-room-sidebar-muted hover:bg-room-sidebar-active hover:text-room-sidebar-fg"
        >
          <Users className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5">
        {conversations.length === 0 ? (
          <p className="px-3 py-2 text-sm text-room-sidebar-muted">No conversations yet.</p>
        ) : (
          conversations.map((conversation) => {
            const profile = profilesById.get(conversation.otherUserId);
            if (!profile) return null;
            const isActive = conversation.id === activeConversationId;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelectConversation(conversation)}
                className={`focus-ring flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  isActive ? "bg-room-sidebar-active" : "hover:bg-room-sidebar-active/60"
                }`}
              >
                <UserAvatar avatarUrl={profile.avatarUrl} username={profile.username} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-medium text-room-sidebar-fg">
                      {profile.displayName ?? profile.username}
                    </span>
                    {conversation.lastMessage && (
                      <span className="shrink-0 text-[11px] text-room-sidebar-muted">
                        {formatPreviewTimestamp(conversation.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-room-sidebar-muted">
                    {conversation.lastMessage?.content ?? "No messages yet"}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
