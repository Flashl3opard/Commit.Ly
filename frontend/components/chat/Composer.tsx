"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Send, Loader2, Paperclip, Smile, Code2 } from "lucide-react";
import { MentionAutocomplete } from "./MentionAutocomplete";
import type { RoomMember } from "@/lib/api/rooms";

const MAX_CONTENT_LENGTH = 4000;
const MAX_MENTION_CANDIDATES = 6;

type ComposerProps = {
  onSend: (content: string) => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  members: RoomMember[];
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
};

type MentionQuery = {
  /** Index of the "@" that started this query, so the eventual insertion knows exactly what to replace. */
  startIndex: number;
  query: string;
};

/**
 * Finds an in-progress @query ending at the cursor, if any — e.g. typing
 * "hey @ali" with the cursor right after "ali" yields { startIndex: 4,
 * query: "ali" }. Returns null once the token is broken by whitespace
 * (finished typing past the handle) or there's no "@" immediately behind
 * the run of handle characters before the cursor.
 */
function findActiveMentionQuery(value: string, cursorIndex: number): MentionQuery | null {
  const uptoCursor = value.slice(0, cursorIndex);
  const match = uptoCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]{0,32})$/);
  if (!match) return null;
  const query = match[1];
  const startIndex = cursorIndex - query.length - 1;
  return { startIndex, query };
}

function filterMentionCandidates(members: RoomMember[], query: string): RoomMember[] {
  const needle = query.toLowerCase();
  return members
    .filter((m) => m.username?.toLowerCase().startsWith(needle) || m.displayName?.toLowerCase().startsWith(needle))
    .slice(0, MAX_MENTION_CANDIDATES);
}

export function Composer({
  onSend,
  onTypingStart,
  onTypingStop,
  members,
  disabled,
  placeholder = "Message this room…",
  autoFocus,
}: ComposerProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const mentionCandidates = mentionQuery ? filterMentionCandidates(members, mentionQuery.query) : [];

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    setError(null);
    try {
      await onSend(trimmed);
      setContent("");
      setMentionQuery(null);
      onTypingStop();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      textareaRef.current?.focus();
    } catch {
      setError("Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function insertMention(member: RoomMember) {
    if (!mentionQuery || !member.username) return;
    const before = content.slice(0, mentionQuery.startIndex);
    const after = content.slice(mentionQuery.startIndex + 1 + mentionQuery.query.length);
    const next = `${before}@${member.username} ${after}`;
    setContent(next);
    setMentionQuery(null);
    setActiveMentionIndex(0);

    const newCursor = before.length + member.username.length + 2;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(newCursor, newCursor);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionCandidates.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveMentionIndex((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        insertMention(mentionCandidates[activeMentionIndex]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const value = event.target.value;
    setContent(value);
    if (value.trim()) {
      onTypingStart();
    } else {
      onTypingStop();
    }

    const cursorIndex = event.target.selectionStart ?? value.length;
    const active = findActiveMentionQuery(value, cursorIndex);
    setMentionQuery(active);
    setActiveMentionIndex(0);

    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <div className="border-t border-border p-3">
      {error && <p className="mb-1.5 px-1 text-xs text-danger">{error}</p>}
      <div className="relative rounded-xl border border-border-strong bg-background-2 px-3 py-2 focus-within:border-accent">
        {mentionQuery && (
          <MentionAutocomplete candidates={mentionCandidates} activeIndex={activeMentionIndex} onSelect={insertMention} />
        )}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            onTypingStop();
            setMentionQuery(null);
          }}
          placeholder={placeholder}
          maxLength={MAX_CONTENT_LENGTH}
          rows={1}
          disabled={disabled}
          autoFocus={autoFocus}
          className="max-h-40 min-h-6 w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {[
              { Icon: Paperclip, label: "Attachments are coming soon" },
              { Icon: Smile, label: "Emoji are coming soon" },
              { Icon: Code2, label: "Code formatting is coming soon" },
            ].map(({ Icon, label }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={label}
                disabled
                className="rounded-md p-1.5 text-muted-2 opacity-50"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!content.trim() || sending || disabled}
            title="Send message"
            aria-label="Send message"
            className="focus-ring shrink-0 rounded-lg bg-linear-to-r from-accent to-accent-2 p-2 text-accent-foreground transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
