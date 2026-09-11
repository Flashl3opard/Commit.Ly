"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { listConversations, openConversation, type DmConversationSummary } from "@/lib/api/dm";
import { getUserProfile } from "@/lib/api/users";
import type { UserSearchResult } from "@/lib/api/users";
import { ConversationList } from "@/components/dm/ConversationList";
import { DmChat } from "@/components/dm/DmChat";
import { FriendsPanel } from "@/components/dm/FriendsPanel";

type State = {
  conversations: DmConversationSummary[];
  profilesById: Map<string, UserSearchResult>;
  loading: boolean;
};

type Action =
  | { kind: "loaded"; conversations: DmConversationSummary[]; profilesById: Map<string, UserSearchResult> }
  | { kind: "conversationUpserted"; conversation: DmConversationSummary; profile: UserSearchResult };

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "loaded":
      return { conversations: action.conversations, profilesById: action.profilesById, loading: false };
    case "conversationUpserted": {
      const existingIndex = state.conversations.findIndex((c) => c.id === action.conversation.id);
      const nextConversations =
        existingIndex === -1
          ? [action.conversation, ...state.conversations]
          : state.conversations.map((c) => (c.id === action.conversation.id ? action.conversation : c));
      const nextProfiles = new Map(state.profilesById);
      nextProfiles.set(action.profile.id, action.profile);
      return { ...state, conversations: nextConversations, profilesById: nextProfiles };
    }
  }
}

/**
 * Friends-only DM surface, parallel to /rooms but not room-scoped. Three
 * panes: a conversation list (left), the active thread or the friends
 * panel (center). Opening a conversation always goes through
 * getOrCreateConversation server-side, which itself re-verifies
 * friendship — this page never assumes a conversation is valid just
 * because it's in the list.
 */
export default function DmPage() {
  const [state, dispatch] = useReducer(reducer, { conversations: [], profilesById: new Map(), loading: true });
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Read once from the initial URL rather than synced via an effect — a
  // deep link from the rail's notification bell (?tab=requests) should
  // open the friends panel on first render; afterward showFriends is an
  // ordinary user-driven toggle, not something that re-syncs to the URL.
  const [showFriends, setShowFriends] = useState(() => searchParams.get("tab") === "requests");

  const loadConversations = useCallback(async () => {
    const { conversations } = await listConversations();
    const profiles = await Promise.all(
      conversations.map((c) => getUserProfile(c.otherUserId).then(({ user }) => user).catch(() => null)),
    );
    const profilesById = new Map<string, UserSearchResult>();
    conversations.forEach((c, index) => {
      const profile = profiles[index];
      if (profile) profilesById.set(c.otherUserId, profile);
    });
    dispatch({ kind: "loaded", conversations, profilesById });

    // A deep link (e.g. from a profile page's "Message" button) names a
    // conversation that may not exist locally yet on a fresh page load —
    // select it once its data has actually loaded, not before.
    const targetConversationId = searchParams.get("conversation");
    if (targetConversationId) {
      setActiveConversationId(targetConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (searchParams.get("tab") === "requests" || searchParams.get("conversation")) {
      router.replace("/dm");
    }
    // Runs once on mount to clean up the deep-link query param — showFriends
    // itself was already initialized from this same param above, and the
    // conversation deep link is consumed inside loadConversations above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleOpenConversationWithFriend(friend: UserSearchResult) {
    const { conversation } = await openConversation(friend.id);
    dispatch({
      kind: "conversationUpserted",
      conversation: { ...conversation, otherUserId: friend.id, lastMessage: null },
      profile: friend,
    });
    setActiveConversationId(conversation.id);
    setShowFriends(false);
  }

  function handleSelectConversation(conversation: DmConversationSummary) {
    setActiveConversationId(conversation.id);
    setShowFriends(false);
  }

  const activeConversation = state.conversations.find((c) => c.id === activeConversationId) ?? null;
  const activeProfile = activeConversation ? state.profilesById.get(activeConversation.otherUserId) : null;

  return (
    <div className="flex min-h-0 flex-1">
      <ConversationList
        conversations={state.conversations}
        profilesById={state.profilesById}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onOpenFriends={() => setShowFriends(true)}
      />

      {showFriends ? (
        <FriendsPanel onOpenConversation={handleOpenConversationWithFriend} initialTab="requests" />
      ) : activeConversation && activeProfile ? (
        <DmChat key={activeConversation.id} conversationId={activeConversation.id} otherUser={activeProfile} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <MessagesSquare className="h-10 w-10 text-muted-2" aria-hidden="true" />
          <h2 className="mt-4 text-base font-semibold text-foreground">Your messages</h2>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Select a conversation, or add a friend to start a new one.
          </p>
          <button
            type="button"
            onClick={() => setShowFriends(true)}
            className="focus-ring mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Find friends
          </button>
        </div>
      )}
    </div>
  );
}
