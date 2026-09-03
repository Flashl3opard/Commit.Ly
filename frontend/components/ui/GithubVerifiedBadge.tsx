import { ShieldCheck } from "lucide-react";

/**
 * Small icon-only GitHub verification indicator. Only ever rendered when
 * githubVerified === true (server-controlled) — never a toggle, never
 * shown as a large text badge. The accessible name carries the meaning
 * since the icon alone isn't self-explanatory.
 */
export function GithubVerifiedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title="GitHub account verified"
      aria-label="GitHub account verified"
      className={`inline-flex shrink-0 items-center justify-center text-accent ${className}`}
    >
      <ShieldCheck className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}
