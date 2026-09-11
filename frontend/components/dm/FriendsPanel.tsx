"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { Search, UserPlus, Check, X, Loader2, UserMinus } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  searchUsers,
  sendFriendRequest,
  respondToFriendRequest,
  listFriendRequests,
  listFriends,
  removeFriend,
  type UserSearchResult,
  type FriendRequestSummary,
  type FriendSummary,
} from "@/lib/api/users";
import { ApiError } from "@/lib/api/types";

type State = {
  friends: FriendSummary[];
  incoming: FriendRequestSummary[];
  outgoing: FriendRequestSummary[];
  loading: boolean;
};

type Action =
  | { kind: "loaded"; friends: FriendSummary[]; incoming: FriendRequestSummary[]; outgoing: FriendRequestSummary[] }
  | { kind: "friendRemoved"; userId: string }
  | { kind: "requestRemoved"; requestId: string }
  | { kind: "friendAdded"; friend: FriendSummary }
  | { kind: "outgoingAdded"; request: FriendRequestSummary };

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "loaded":
      return { friends: action.friends, incoming: action.incoming, outgoing: action.outgoing, loading: false };
    case "friendRemoved":
      return { ...state, friends: state.friends.filter((f) => f.id !== action.userId) };
    case "requestRemoved":
      return {
        ...state,
        incoming: state.incoming.filter((r) => r.id !== action.requestId),
        outgoing: state.outgoing.filter((r) => r.id !== action.requestId),
      };
    case "friendAdded":
      return { ...state, friends: [action.friend, ...state.friends] };
    case "outgoingAdded":
      return { ...state, outgoing: [action.request, ...state.outgoing] };
  }
}

type SearchState = { results: UserSearchResult[]; searching: boolean };

type SearchAction =
  | { kind: "reset" }
  | { kind: "started" }
  | { kind: "settled"; results: UserSearchResult[] };

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.kind) {
    case "reset":
      return { results: [], searching: false };
    case "started":
      return { ...state, searching: true };
    case "settled":
      return { results: action.results, searching: false };
  }
}

/**
 * Owns friend search + request lifecycle + friends list, all in one
 * reducer per this codebase's established pattern (see
 * RoomModulesContext/useRoomChannels) for avoiding
 * react-hooks/set-state-in-effect on the initial-load effect.
 */
export function FriendsPanel({
  onOpenConversation,
  initialTab = "friends",
}: {
  onOpenConversation: (user: UserSearchResult) => void;
  initialTab?: "friends" | "requests";
}) {
  const [state, dispatch] = useReducer(reducer, { friends: [], incoming: [], outgoing: [], loading: true });
  const [tab, setTab] = useState<"friends" | "requests" | "search">(initialTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, searchDispatch] = useReducer(searchReducer, { results: [], searching: false });
  const [pendingActionUserId, setPendingActionUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    Promise.all([listFriends(), listFriendRequests()]).then(([friendsRes, requestsRes]) => {
      dispatch({ kind: "loaded", friends: friendsRes.friends, incoming: requestsRes.incoming, outgoing: requestsRes.outgoing });
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    searchDispatch({ kind: "reset" });

    if (tab !== "search" || searchQuery.trim().length === 0) {
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      searchDispatch({ kind: "started" });
      searchUsers(searchQuery.trim())
        .then(({ users }) => {
          if (!cancelled) searchDispatch({ kind: "settled", results: users });
        })
        .catch(() => {
          if (!cancelled) searchDispatch({ kind: "settled", results: [] });
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [tab, searchQuery]);

  async function handleSendRequest(target: UserSearchResult) {
    setPendingActionUserId(target.id);
    setActionError(null);
    try {
      const { request } = await sendFriendRequest(target.username);
      dispatch({ kind: "outgoingAdded", request });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't send friend request.");
    } finally {
      setPendingActionUserId(null);
    }
  }

  async function handleRespond(request: FriendRequestSummary, action: "accept" | "reject") {
    setPendingActionUserId(request.otherUser.id);
    setActionError(null);
    try {
      await respondToFriendRequest(request.id, action);
      dispatch({ kind: "requestRemoved", requestId: request.id });
      if (action === "accept") {
        dispatch({ kind: "friendAdded", friend: { ...request.otherUser, friendsSince: new Date().toISOString() } });
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't respond to friend request.");
    } finally {
      setPendingActionUserId(null);
    }
  }

  async function handleRemoveFriend(friend: FriendSummary) {
    setPendingActionUserId(friend.id);
    setActionError(null);
    try {
      await removeFriend(friend.id);
      dispatch({ kind: "friendRemoved", userId: friend.id });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't remove friend.");
    } finally {
      setPendingActionUserId(null);
    }
  }

  const outgoingUsernames = new Set(state.outgoing.map((r) => r.otherUser.username));
  const friendUsernames = new Set(state.friends.map((f) => f.username));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-3 py-2">
        <TabButton label="Friends" active={tab === "friends"} onClick={() => setTab("friends")} />
        <TabButton
          label="Requests"
          active={tab === "requests"}
          badge={state.incoming.length}
          onClick={() => setTab("requests")}
        />
        <TabButton label="Add friend" active={tab === "search"} onClick={() => setTab("search")} />
      </div>

      {actionError && (
        <div className="mx-3 mt-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger">
          {actionError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {tab === "search" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border-strong bg-background-2 px-3 py-2">
              <Search className="h-4 w-4 text-muted-2" aria-hidden="true" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
                autoFocus
              />
              {searchState.searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-2" aria-hidden="true" />}
            </div>

            {searchState.results.map((result) => {
              const alreadyFriend = friendUsernames.has(result.username);
              const alreadySent = outgoingUsernames.has(result.username);
              return (
                <div key={result.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                  <UserAvatar avatarUrl={result.avatarUrl} username={result.username} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{result.displayName ?? result.username}</p>
                    <p className="truncate text-xs text-muted-2">@{result.username}</p>
                  </div>
                  {alreadyFriend ? (
                    <span className="text-xs text-muted-2">Friends</span>
                  ) : alreadySent ? (
                    <span className="text-xs text-muted-2">Requested</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendRequest(result)}
                      disabled={pendingActionUserId === result.id}
                      className="focus-ring flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {pendingActionUserId === result.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <UserPlus className="h-3 w-3" aria-hidden="true" />
                      )}
                      Add
                    </button>
                  )}
                </div>
              );
            })}

            {!searchState.searching && searchQuery.trim().length > 0 && searchState.results.length === 0 && (
              <p className="px-2 text-sm text-muted-2">No users found.</p>
            )}
          </div>
        )}

        {tab === "requests" && (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-2 uppercase">Incoming</h3>
              {state.incoming.length === 0 ? (
                <p className="text-sm text-muted-2">No pending requests.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {state.incoming.map((request) => (
                    <div key={request.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                      <UserAvatar avatarUrl={request.otherUser.avatarUrl} username={request.otherUser.username} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {request.otherUser.displayName ?? request.otherUser.username}
                        </p>
                        <p className="truncate text-xs text-muted-2">@{request.otherUser.username}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRespond(request, "accept")}
                        disabled={pendingActionUserId === request.otherUser.id}
                        title="Accept"
                        aria-label="Accept request"
                        className="focus-ring rounded-md p-1.5 text-success hover-surface disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespond(request, "reject")}
                        disabled={pendingActionUserId === request.otherUser.id}
                        title="Reject"
                        aria-label="Reject request"
                        className="focus-ring rounded-md p-1.5 text-danger hover-surface disabled:opacity-50"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-2 uppercase">Sent</h3>
              {state.outgoing.length === 0 ? (
                <p className="text-sm text-muted-2">No outgoing requests.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {state.outgoing.map((request) => (
                    <div key={request.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5">
                      <UserAvatar avatarUrl={request.otherUser.avatarUrl} username={request.otherUser.username} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {request.otherUser.displayName ?? request.otherUser.username}
                        </p>
                        <p className="truncate text-xs text-muted-2">@{request.otherUser.username}</p>
                      </div>
                      <span className="text-xs text-muted-2">Pending</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "friends" && (
          <div className="flex flex-col gap-1">
            {state.friends.length === 0 ? (
              <p className="px-2 text-sm text-muted-2">No friends yet — search a username to add one.</p>
            ) : (
              state.friends.map((friend) => (
                <div key={friend.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover-surface-weak">
                  <button
                    type="button"
                    onClick={() => onOpenConversation(friend)}
                    className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
                  >
                    <UserAvatar avatarUrl={friend.avatarUrl} username={friend.username} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{friend.displayName ?? friend.username}</p>
                      <p className="truncate text-xs text-muted-2">@{friend.username}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveFriend(friend)}
                    disabled={pendingActionUserId === friend.id}
                    title="Remove friend"
                    aria-label="Remove friend"
                    className="focus-ring rounded-md p-1.5 text-muted-2 opacity-0 hover:bg-danger-bg hover:text-danger group-hover:opacity-100 disabled:opacity-50"
                  >
                    {pendingActionUserId === friend.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, badge, onClick }: { label: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-background-3 text-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
      {Boolean(badge) && (
        <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
