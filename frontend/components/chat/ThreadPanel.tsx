"use client";

import { X } from "lucide-react";
import { MessageItem } from "./MessageItem";
import type { Message } from "@/lib/api/chat";
import type { RoomMember } from "@/lib/api/rooms";

type ThreadPanelProps = {
  parentMessage: Message;
  sender: RoomMember | undefined;
  onClose: () => void;
};

/**
 * Non-functional preview: shows the parent message and an honest empty
 * state instead of a working reply list, per the explicit "design threads
 * into the experience even if they aren't implemented yet, don't fake
 * functionality" requirement. No reply can be sent or persisted here.
 */
export function ThreadPanel({ parentMessage, sender, onClose }: ThreadPanelProps) {
  return (
    <div className="flex h-full w-full shrink-0 flex-col border-l border-border bg-background md:w-80">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Thread</h2>
        <button
          type="button"
          onClick={onClose}
          title="Close thread"
          aria-label="Close thread"
          className="focus-ring rounded-lg p-1.5 text-muted-2 hover:bg-background-3 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <MessageItem
          message={parentMessage}
          sender={sender}
          isOwnMessage={false}
          isGroupedWithPrevious={false}
          railPosition="none"
          onEdit={async () => {}}
          onDelete={async () => {}}
        />
        <div className="mx-4 mt-6 flex flex-col items-center px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Threads are coming soon</p>
          <p className="mt-1 text-xs text-muted">Replies aren&apos;t saved yet — check back in a future update.</p>
        </div>
      </div>

      <div className="border-t border-border p-3">
        <div
          className="flex items-center rounded-xl border border-border-strong bg-background-2 px-3 py-2 opacity-50"
          title="Threaded replies are coming soon"
        >
          <span className="flex-1 text-sm text-muted-2">Reply...</span>
        </div>
      </div>
    </div>
  );
}
