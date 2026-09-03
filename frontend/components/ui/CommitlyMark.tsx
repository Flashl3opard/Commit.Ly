/**
 * Commit.ly's brand mark: a commit node with two branches converging into
 * it, rendered in the accent gradient. Replaces the GitHub octocat as the
 * wordmark icon — this is our identity, not GitHub's.
 */
export function CommitlyMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="commitly-mark-gradient" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <path
        d="M6 5.5v4.5c0 2.5 2 4 4.5 4H15M18 5.5v4.5c0 2.5-2 4-4.5 4"
        stroke="url(#commitly-mark-gradient)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <circle cx="6" cy="5" r="2.5" fill="url(#commitly-mark-gradient)" />
      <circle cx="18" cy="5" r="2.5" fill="url(#commitly-mark-gradient)" />
      <circle cx="17.5" cy="18.5" r="3" fill="url(#commitly-mark-gradient)" />
    </svg>
  );
}
