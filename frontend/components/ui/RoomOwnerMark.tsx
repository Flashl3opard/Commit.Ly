/**
 * Room ownership indicator — authority within THIS room, a completely
 * different concept from GitHub account verification (GithubVerifiedBadge).
 * Deliberately never ShieldCheck/text-accent (that combination already
 * means "GitHub verified" everywhere else in the app) — a solid amber
 * diamond reads as "special standing here" without being mistaken for a
 * platform-level checkmark. Subtle by design: no "OWNER" text badge, just
 * this mark plus a tooltip on hover.
 */
export function RoomOwnerMark({ className = "" }: { className?: string }) {
  return (
    <span
      title="Room owner"
      aria-label="Room owner"
      className={`inline-flex shrink-0 items-center justify-center text-warning ${className}`}
    >
      <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
        <path d="M8 1.5L14.5 8L8 14.5L1.5 8L8 1.5Z" />
      </svg>
    </span>
  );
}
