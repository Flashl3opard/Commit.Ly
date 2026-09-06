import { PushActivityCard } from "./PushActivityCard";
import { PullRequestActivityCard } from "./PullRequestActivityCard";
import { IssueActivityCard } from "./IssueActivityCard";
import type { Message } from "@/lib/api/chat";

type GithubActivityCardProps = {
  message: Message;
  railPosition: "none" | "start" | "middle";
};

export function GithubActivityCard({ message, railPosition }: GithubActivityCardProps) {
  const eventType = message.systemEventType ?? "";

  if (eventType === "github.push") {
    return <PushActivityCard message={message} railPosition={railPosition} />;
  }
  if (eventType.startsWith("github.pull_request.")) {
    return <PullRequestActivityCard message={message} railPosition={railPosition} />;
  }
  if (eventType.startsWith("github.issue.")) {
    return <IssueActivityCard message={message} railPosition={railPosition} />;
  }

  // Unknown future event type — render generically rather than nothing,
  // so a new backend event type never silently disappears from the UI.
  return (
    <PushActivityCard message={message} railPosition={railPosition} />
  );
}
