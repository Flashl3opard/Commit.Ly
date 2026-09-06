import { GitPullRequest, GitMerge } from "lucide-react";
import { ActivityCardShell } from "./ActivityCardShell";
import { safeGithubUrl } from "./githubUrl";
import type { Message } from "@/lib/api/chat";

export function PullRequestActivityCard({ message, railPosition }: { message: Message; railPosition: "none" | "start" | "middle" }) {
  const eventType = message.systemEventType ?? "";
  const isMerged = eventType === "github.pull_request.merged";
  const isClosed = eventType === "github.pull_request.closed";
  const url = safeGithubUrl(message.metadata?.url);

  return (
    <ActivityCardShell
      icon={
        isMerged ? (
          <GitMerge className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <GitPullRequest className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
        )
      }
      accent={isMerged ? "success" : isClosed ? "danger" : "accent"}
      label="Pull Request"
      headline={message.content ?? ""}
      secondary={message.metadata?.title}
      badge={isMerged ? "Merged" : isClosed ? "Closed" : "Open"}
      linkHref={isMerged ? null : url}
      linkLabel="View pull request"
      railPosition={railPosition}
    />
  );
}
