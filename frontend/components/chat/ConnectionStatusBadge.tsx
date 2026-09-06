import { Loader2, WifiOff } from "lucide-react";
import type { ConnectionState } from "@/lib/chat/ChatSocket";

/**
 * Subtle by design — only "reconnecting" and "disconnected" render
 * anything at all. A healthy "connected" state stays silent so the UI
 * isn't noisy on the common path.
 */
export function ConnectionStatusBadge({ state }: { state: ConnectionState }) {
  if (state === "connected" || state === "connecting") return null;

  if (state === "reconnecting") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-background-2 px-2.5 py-1 text-xs text-muted">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        Reconnecting…
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-danger-border bg-danger-bg px-2.5 py-1 text-xs text-danger">
      <WifiOff className="h-3 w-3" aria-hidden="true" />
      Disconnected
    </span>
  );
}
