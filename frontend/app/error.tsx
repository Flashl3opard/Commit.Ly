"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

/**
 * Next.js route-segment error boundary — catches render/render-phase
 * errors anywhere under this segment. `error` is logged for developers
 * only (console, never rendered) since it can carry stack traces or other
 * implementation detail that must never reach the user-facing copy.
 */
export default function GlobalErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <ErrorState
        title="500 — Something broke upstream."
        description="An unexpected error occurred. Try again, or come back in a moment."
        onRetry={reset}
      />
    </div>
  );
}
