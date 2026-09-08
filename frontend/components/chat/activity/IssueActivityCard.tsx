import { CircleDot, CheckCircle2 } from "lucide-react";
import { ActivityCardShell } from "./ActivityCardShell";
import { safeGithubUrl } from "./githubUrl";
import type { Message } from "@/lib/api/chat";

export function IssueActivityCard({ message, railPosition }: { message: Message; railPosition: "none" | "start" | "middle" }) {
  const isClosed = message.systemEventType === "github.issue.closed";
  const url = safeGithubUrl(message.metadata?.url);

  return (
    <ActivityCardShell
      icon={
        isClosed ? (
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <CircleDot className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        )
      }
      accent={isClosed ? "danger" : "accent"}
      label="Issue"
      headline={message.content ?? ""}
      secondary={message.metadata?.title}
      badge={isClosed ? "Closed" : "Open"}
      linkHref={url}
      linkLabel="View issue"
      railPosition={railPosition}
    />
  );
}
