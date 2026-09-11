"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, MessageSquare, UserMinus, UserPlus, UserX } from "lucide-react";
import {
  listFriends,
  listFriendRequests,
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  type FriendRequestSummary,
} from "@/lib/api/users";
import { openConversation } from "@/lib/api/dm";
import { ApiError } from "@/lib/api/types";
import type { PublicProfile } from "@/lib/api/types";

type RelationshipState =
  | { kind: "loading" }
  | { kind: "friends" }
  | { kind: "incoming"; request: FriendRequestSummary }
  | { kind: "outgoing" }
  | { kind: "none" };

/**
 * Determines the viewer's relationship with the profile being viewed by
 * cross-referencing the existing friends/requests list endpoints — no
 * dedicated "relationship status" endpoint exists, and listing is cheap
 * enough (these lists are small) that a profile-page mount doesn't
 * warrant adding one.
 */
async function loadRelationship(otherUserId: string): Promise<RelationshipState> {
  const [{ friends }, { incoming, outgoing }] = await Promise.all([listFriends(), listFriendRequests()]);

  if (friends.some((f) => f.id === otherUserId)) {
    return { kind: "friends" };
  }

  const incomingRequest = incoming.find((r) => r.senderId === otherUserId);
  if (incomingRequest) {
    return { kind: "incoming", request: incomingRequest };
  }

  if (outgoing.some((r) => r.receiverId === otherUserId)) {
    return { kind: "outgoing" };
  }

  return { kind: "none" };
}

export function FriendActionButton({ profile }: { profile: PublicProfile }) {
  const [state, setState] = useState<RelationshipState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadRelationship(profile.id).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  async function handleAdd() {
    setBusy(true);
    setError(null);
    try {
      await sendFriendRequest(profile.username);
      setState({ kind: "outgoing" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send friend request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept() {
    if (state.kind !== "incoming") return;
    setBusy(true);
    setError(null);
    try {
      await respondToFriendRequest(state.request.id, "accept");
      setState({ kind: "friends" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't accept friend request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (state.kind !== "incoming") return;
    setBusy(true);
    setError(null);
    try {
      await respondToFriendRequest(state.request.id, "reject");
      setState({ kind: "none" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't reject friend request.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setBusy(true);
    setError(null);
    try {
      await removeFriend(profile.id);
      setState({ kind: "none" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't remove friend.");
    } finally {
      setBusy(false);
    }
  }

  async function handleMessage() {
    setBusy(true);
    setError(null);
    try {
      const { conversation } = await openConversation(profile.id);
      setConversationId(conversation.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't open conversation.");
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "loading") {
    return (
      <div className="flex h-10 w-32 items-center justify-center rounded-lg border border-border-strong">
        <Loader2 className="h-4 w-4 animate-spin text-muted-2" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {state.kind === "friends" && (
          <>
            {conversationId ? (
              <Link
                href={`/dm?conversation=${conversationId}`}
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02]"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" />
                Open chat
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleMessage}
                disabled={busy}
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MessageSquare className="h-4 w-4" aria-hidden="true" />}
                Message
              </button>
            )}
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              title="Remove friend"
              aria-label="Remove friend"
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2.5 text-sm font-medium text-muted transition-colors hover-surface disabled:opacity-60"
            >
              <UserMinus className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}

        {state.kind === "incoming" && (
          <>
            <button
              type="button"
              onClick={handleAccept}
              disabled={busy}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              Accept
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={busy}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover-surface disabled:opacity-60"
            >
              <UserX className="h-4 w-4" aria-hidden="true" />
              Decline
            </button>
          </>
        )}

        {state.kind === "outgoing" && (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2.5 text-sm font-medium text-muted-2">
            Request sent
          </span>
        )}

        {state.kind === "none" && (
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserPlus className="h-4 w-4" aria-hidden="true" />}
            Add friend
          </button>
        )}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
