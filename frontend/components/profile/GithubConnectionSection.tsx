"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Unlink } from "lucide-react";
import { getGithubStatus, connectGithubUrl, disconnectGithub, type GithubStatus } from "@/lib/api/github";
import { GithubVerifiedBadge } from "@/components/ui/GithubVerifiedBadge";
import { GithubIcon } from "@/components/ui/GithubIcon";

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
          <div className="flex flex-wrap items-center gap-2.5">
            <GithubIcon className="h-4 w-4 text-foreground" />
            <span className="text-sm text-foreground">@{status.github.username}</span>
            <GithubVerifiedBadge />
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              title="Disconnect GitHub"
              aria-label="Disconnect GitHub"
              className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5 disabled:opacity-60"
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
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
              <GithubIcon className="h-4 w-4" />
              Connect GitHub
            </a>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
