/**
 * Commit.ly's error-state mascot: a minimal, geometric cat silhouette in
 * the same accent-gradient stroke language as CommitlyMark, so it reads as
 * part of the same brand family rather than a bolted-on illustration.
 * Used only for exception/empty states (404/403/500/offline/etc) — never
 * as a general-purpose logo, which stays CommitlyMark's job.
 */
export function CommitlyCat({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="commitly-cat-gradient" x1="6" y1="8" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="100%" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      {/* Ears */}
      <path
        d="M13 16L10 7L19 12.5"
        stroke="url(#commitly-cat-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35 16L38 7L29 12.5"
        stroke="url(#commitly-cat-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Head */}
      <circle cx="24" cy="24" r="13" stroke="url(#commitly-cat-gradient)" strokeWidth="2" />
      {/* Eyes */}
      <circle cx="19" cy="23" r="1.6" fill="url(#commitly-cat-gradient)" />
      <circle cx="29" cy="23" r="1.6" fill="url(#commitly-cat-gradient)" />
      {/* Muzzle + whiskers, echoing CommitlyMark's converging-branches motif */}
      <path
        d="M24 27v2.5"
        stroke="url(#commitly-cat-gradient)"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M24 29.5c-1.8 0-3.2 1-3.2 2M24 29.5c1.8 0 3.2 1 3.2 2"
        stroke="url(#commitly-cat-gradient)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </svg>
  );
}
