"use client";

import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Send, Loader2, Paperclip, Smile, AtSign, Code2 } from "lucide-react";

const MAX_CONTENT_LENGTH = 4000;

type ComposerProps = {
  onSend: (content: string) => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
};

export function Composer({ onSend, onTypingStart, onTypingStop, disabled }: ComposerProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    setError(null);
    try {
      await onSend(trimmed);
      setContent("");
      onTypingStop();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      textareaRef.current?.focus();
    } catch {
      setError("Couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
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

    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <div className="border-t border-border p-3">
      {error && <p className="mb-1.5 px-1 text-xs text-danger">{error}</p>}
      <div className="rounded-xl border border-border-strong bg-background-2 px-3 py-2 focus-within:border-accent">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onTypingStop}
          placeholder="Message this room…"
          maxLength={MAX_CONTENT_LENGTH}
          rows={1}
          disabled={disabled}
          className="max-h-40 min-h-6 w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-2 focus:outline-none disabled:opacity-60"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            {[
              { Icon: Paperclip, label: "Attachments are coming soon" },
              { Icon: Smile, label: "Emoji are coming soon" },
              { Icon: AtSign, label: "Mentions are coming soon" },
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
