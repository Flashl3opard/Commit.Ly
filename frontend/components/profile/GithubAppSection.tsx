"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink, FolderGit2, Loader2, Lock, Globe } from "lucide-react";
import {
  getGithubAppStatus,
  getGithubAppRepositories,
  installGithubAppUrl,
  type GithubAppStatus,
  type GithubAppRepository,
} from "@/lib/api/github";
import { GithubIcon } from "@/components/ui/GithubIcon";

/**
 * Repository access via the Commit.ly GitHub App — a distinct concept from
 * GitHub OAuth identity (GithubConnectionSection). Backed by
 * GET /github/app/status and GET /github/app/repositories.
 */
function initialErrorFromParams(searchParams: URLSearchParams): string | null {
  const outcome = searchParams.get("github_app");
  if (outcome === "error") {
    const reason = searchParams.get("reason");
    if (reason === "verification_failed") {
      return "This GitHub App installation could not be verified for your account.";
    }
    if (reason === "github_error") {
      return "GitHub could not complete the installation. Please try again.";
    }
    return "Something went wrong installing the Commit.ly GitHub App. Please try again.";
  }
  return null;
}

export function GithubAppSection() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<GithubAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(() => initialErrorFromParams(searchParams));

  const [showRepositories, setShowRepositories] = useState(false);
  const [repositories, setRepositories] = useState<GithubAppRepository[] | null>(null);
  const [repositoriesLoading, setRepositoriesLoading] = useState(false);
  const [repositoriesError, setRepositoriesError] = useState<string | null>(null);

  useEffect(() => {
    getGithubAppStatus()
      .then(setStatus)
      .catch(() => setStatus({ installed: false, installation: null }))
      .finally(() => setLoading(false));
  }, []);

  async function handleViewRepositories() {
    setShowRepositories(true);
    if (repositories) return;

    setRepositoriesLoading(true);
    setRepositoriesError(null);
    try {
      const { repositories: repos } = await getGithubAppRepositories();
      setRepositories(repos);
    } catch {
      setRepositoriesError("Unable to load repositories. Please try again.");
    } finally {
      setRepositoriesLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-5">
      <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">Repository access</p>

      <div className="mt-3">
        {loading ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
        ) : status?.installed && status.installation ? (
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                <Check className="h-4 w-4 text-accent" strokeWidth={2.5} aria-hidden="true" />
                GitHub App installed
              </span>
              <span className="text-sm text-muted">on {status.installation.accountLogin}</span>
            </div>
            {!showRepositories && (
              <button
                type="button"
                onClick={handleViewRepositories}
                className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
              >
                <FolderGit2 className="h-4 w-4" aria-hidden="true" />
                View repositories
              </button>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm text-muted">Commit.ly can access your authorized repositories.</p>
            <a
              href={installGithubAppUrl()}
              className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg border border-border-strong px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
            >
              <GithubIcon className="h-4 w-4" />
              Install Commit.ly on GitHub
            </a>
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      {showRepositories && (
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-xs font-medium tracking-wide text-muted-2 uppercase">Repositories</p>

          {repositoriesLoading ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading repositories…
            </div>
          ) : repositoriesError ? (
            <p className="mt-3 text-sm text-danger">{repositoriesError}</p>
          ) : repositories && repositories.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {repositories.map((repo) => (
                <li key={repo.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
                    <span className="text-sm font-medium text-foreground">{repo.name}</span>
                    {repo.private ? (
                      <Lock className="h-3.5 w-3.5 text-muted-2" aria-label="Private repository" />
                    ) : (
                      <Globe className="h-3.5 w-3.5 text-muted-2" aria-label="Public repository" />
                    )}
                  </div>
                  <a
                    href={repo.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring mt-1 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
                  >
                    {repo.fullName}
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  {repo.defaultBranch && (
                    <p className="mt-0.5 text-xs text-muted-2">{repo.defaultBranch}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">No repositories are currently available to Commit.ly.</p>
          )}
        </div>
      )}
    </div>
  );
}
