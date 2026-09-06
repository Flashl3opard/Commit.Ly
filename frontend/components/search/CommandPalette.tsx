"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Hash, MessageSquare, GitPullRequest, Loader2 } from "lucide-react";
import { useRooms } from "@/lib/rooms/RoomsContext";
import { searchMessages } from "@/lib/api/chat";
import { searchGithubActivity, type GithubSearchResult } from "@/lib/api/github";
import type { Message } from "@/lib/api/chat";

const DEBOUNCE_MS = 400;

type CommandPaletteProps = {
  isOpen: boolean;
  onClose: () => void;
  /** Search context for the room currently being viewed, if any. */
  currentRoom: { id: string; repositoryId: string } | null;
};

type State = {
  query: string;
  messageResults: Message[];
  githubResults: GithubSearchResult[];
  searching: boolean;
};

type Action =
  | { kind: "reset" }
  | { kind: "queryChanged"; query: string }
  | { kind: "searchStarted" }
  | { kind: "searchSettled"; messages: Message[]; github: GithubSearchResult[] };

const initialState: State = { query: "", messageResults: [], githubResults: [], searching: false };

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case "reset":
      return initialState;
    case "queryChanged":
      return { ...state, query: action.query };
    case "searchStarted":
      return { ...state, searching: true };
    case "searchSettled":
      return { ...state, messageResults: action.messages, githubResults: action.github, searching: false };
  }
}

/**
 * Local state is a single reducer (not several useState calls) so the
 * open-triggered reset and the debounced-search settle can both dispatch
 * from inside effects without tripping react-hooks/set-state-in-effect —
 * the same pattern used by useChatRoom for the identical reason.
 */
export function CommandPalette({ isOpen, onClose, currentRoom }: CommandPaletteProps) {
  const { rooms } = useRooms();
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, initialState);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      dispatch({ kind: "reset" });
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => {
    const trimmed = state.query.trim();
    if (!trimmed) {
      dispatch({ kind: "searchSettled", messages: [], github: [] });
      return;
    }

    dispatch({ kind: "searchStarted" });
    const timer = setTimeout(async () => {
      try {
        const [messages, github] = await Promise.all([
          currentRoom ? searchMessages(currentRoom.id, trimmed).then((r) => r.messages) : Promise.resolve([]),
          currentRoom ? searchGithubActivity(currentRoom.repositoryId, trimmed).then((r) => r.results) : Promise.resolve([]),
        ]);
        dispatch({ kind: "searchSettled", messages, github });
      } catch {
        dispatch({ kind: "searchSettled", messages: [], github: [] });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [state.query, currentRoom]);

  if (!isOpen) return null;

  const trimmedQuery = state.query.trim();
  const filteredRooms = rooms.filter(
    (room) =>
      !trimmedQuery ||
      room.name.toLowerCase().includes(trimmedQuery.toLowerCase()) ||
      room.repository.fullName.toLowerCase().includes(trimmedQuery.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[15vh]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Commit.ly"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border-strong bg-background-2 shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
          <input
            ref={inputRef}
            value={state.query}
            onChange={(e) => dispatch({ kind: "queryChanged", query: e.target.value })}
            placeholder="Search Commit.ly…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
          />
          {state.searching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-2" aria-hidden="true" />}
        </div>

        <div className="max-h-96 overflow-y-auto py-2">
          {state.messageResults.length > 0 && (
            <div className="px-2 py-1">
              <p className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-2 uppercase">Messages</p>
              {state.messageResults.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    if (currentRoom) router.push(`/rooms/${currentRoom.id}`);
                  }}
                  className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-background-3"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-2" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{message.content}</span>
                </button>
              ))}
            </div>
          )}

          {state.githubResults.length > 0 && (
            <div className="px-2 py-1">
              <p className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-2 uppercase">GitHub</p>
              {state.githubResults.map((result) => (
                <a
                  key={result.id}
                  href={result.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-background-3"
                >
                  <GitPullRequest className="h-3.5 w-3.5 shrink-0 text-muted-2" aria-hidden="true" />
                  <span className="shrink-0 font-mono text-xs text-muted-2">#{result.number}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{result.title}</span>
                </a>
              ))}
            </div>
          )}

          <div className="px-2 py-1">
            <p className="px-2 py-1 text-[11px] font-semibold tracking-wide text-muted-2 uppercase">Rooms</p>
            {filteredRooms.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-muted">No rooms match.</p>
            ) : (
              filteredRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/rooms/${room.id}`);
                  }}
                  className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-background-3"
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 text-muted-2" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{room.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
