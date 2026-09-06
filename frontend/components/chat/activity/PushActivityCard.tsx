import { ArrowUp } from "lucide-react";
import { ActivityCardShell } from "./ActivityCardShell";
import type { Message } from "@/lib/api/chat";

export function PushActivityCard({ message, railPosition }: { message: Message; railPosition: "none" | "start" | "middle" }) {
  const commitCount = message.metadata?.commitCount ?? 0;
  const afterSha = message.metadata?.afterSha;
  const shortSha = afterSha ? afterSha.slice(0, 7) : null;

  return (
    <ActivityCardShell
      icon={<ArrowUp className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />}
      accent="accent"
      label="Push"
      headline={message.content ?? ""}
      secondary={shortSha ? `${commitCount} commit${commitCount === 1 ? "" : "s"} · ${shortSha}` : undefined}
      railPosition={railPosition}
    />
  );
}
