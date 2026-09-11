"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Send, Loader2 } from "lucide-react";

const MAX_CONTENT_LENGTH = 4000;

type DmComposerProps = {
  onSend: (content: string) => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * A DM's composer is deliberately a plain text box — no @mention
 * autocomplete, since a 1:1 conversation has nobody to mention besides
 * the person you're already talking to. Otherwise mirrors Composer.tsx's
 * send/typing behavior exactly.
 */
export function DmComposer({ onSend, onTypingStart, onTypingStop, disabled, placeholder = "Message…" }: DmComposerProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setContent(event.target.value);
    if (event.target.value.trim().length > 0) {
      onTypingStart();
    } else {
      onTypingStop();
    }
  }

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setContent("");
      onTypingStop();
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  }

  return (
    <div className="border-t border-border bg-room-chat-bg px-4 py-3">
      <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-background-2 px-3 py-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onTypingStop}
          maxLength={MAX_CONTENT_LENGTH}
          disabled={disabled}
          rows={1}
          placeholder={placeholder}
          className="max-h-32 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!content.trim() || sending || disabled}
          aria-label="Send message"
          className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-opacity disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
