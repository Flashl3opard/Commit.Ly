import { GitPullRequest, GitMerge, CircleDot, ArrowUpRight } from "lucide-react";
import type { Message } from "@/lib/api/chat";

/**
 * Renders structured metadata for a GitHub system message — the human-
 * readable sentence (message.content) is generated centrally by GitHub
 * Service, never re-derived here; this component only adds icon/link
 * presentation on top of it.
 */

const EVENT_ICONS: Record<string, typeof GitPullRequest> = {
  "github.push": ArrowUpRight,
  "github.pull_request.opened": GitPullRequest,
  "github.pull_request.reopened": GitPullRequest,
  "github.pull_request.closed": GitPullRequest,
  "github.pull_request.merged": GitMerge,
  "github.issue.opened": CircleDot,
  "github.issue.closed": CircleDot,
  "github.issue.reopened": CircleDot,
};

const LINK_LABELS: Record<string, string> = {
  "github.pull_request.opened": "View pull request",
  "github.pull_request.reopened": "View pull request",
  "github.pull_request.closed": "View pull request",
  "github.issue.opened": "View issue",
  "github.issue.closed": "View issue",
  "github.issue.reopened": "View issue",
};

/**
 * Only ever renders an https://github.com/... link — GitHub URLs are
 * external, untrusted-origin data as far as the frontend is concerned
 * (Chat Service already validates this server-side, but the UI never
 * trusts that alone). Any other scheme/host is silently not linked.
 */
function safeGithubUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "github.com") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function GithubActivityMessage({ message }: { message: Message }) {
  const eventType = message.systemEventType ?? "";
  const Icon = EVENT_ICONS[eventType] ?? ArrowUpRight;
  const linkLabel = LINK_LABELS[eventType];
  const url = safeGithubUrl(message.metadata?.url);

  return (
    <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-background-2/60 px-3.5 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-2">GitHub Activity</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{message.content}</p>
        {url && linkLabel && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            {linkLabel}
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
