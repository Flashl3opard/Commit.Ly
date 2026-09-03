"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getGithubStatus, connectGithubUrl, disconnectGithub, type GithubStatus } from "@/lib/api/github";

/**
 * Connect/disconnect GitHub control, backed by GET /github/status —
 * shared by the profile page and the onboarding GitHub step. Never infers
 * verification from anything but the server response.
 */
function initialErrorFromParams(searchParams: URLSearchParams): string | null {
  const outcome = searchParams.get("github");
  if (outcome === "denied") {
    return "GitHub authorization was cancelled.";
  }
  if (outcome === "error") {
    const reason = searchParams.get("reason");
    return reason === "already_linked"
      ? "That GitHub account is already connected to another Commit.ly account."
      : "Something went wrong connecting GitHub. Please try again.";
  }
  return null;
}

export function GithubConnectionSection({ returnTo }: { returnTo?: "onboarding" }) {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GithubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(() => initialErrorFromParams(searchParams));

  useEffect(() => {
    getGithubStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false, github: null, verified: false }))
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);
    try {
      const next = await disconnectGithub();
      setStatus(next);
    } catch {
      setError("Failed to disconnect GitHub. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">GitHub</p>

      <div className="mt-3">
        {loading ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        ) : status?.connected && status.github ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 font-mono text-sm text-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              GitHub Verified
            </span>
            <span className="text-sm text-muted">@{status.github.username}</span>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="focus-ring ml-auto rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5 disabled:opacity-60"
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">Connect your GitHub account to verify your developer identity.</p>
            <a
              href={connectGithubUrl(returnTo)}
              className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.93.57.1.79-.25.79-.55 0-.27-.01-1.15-.02-2.09-3.2.7-3.88-1.35-3.88-1.35-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.08.78 2.17 0 1.57-.01 2.83-.01 3.22 0 .3.21.66.8.55A10.53 10.53 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
              </svg>
              Connect GitHub
            </a>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
