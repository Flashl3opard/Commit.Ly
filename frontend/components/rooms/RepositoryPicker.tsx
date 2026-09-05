"use client";

import { useEffect, useState } from "react";
import { FolderGit2, Lock, Globe, Loader2, ExternalLink } from "lucide-react";
import {
  getGithubAppStatus,
  getGithubAppRepositories,
  installGithubAppUrl,
  type GithubAppRepository,
} from "@/lib/api/github";
import { GithubIcon } from "@/components/ui/GithubIcon";

type RepositoryPickerProps = {
  selectedId: string | null;
  onSelect: (repository: GithubAppRepository) => void;
};

type LoadState = "loading" | "not-connected" | "not-installed" | "no-repositories" | "ready" | "error";

/**
 * Repository selection is limited to what the GitHub App installation
 * already authorizes — the user can never type a repository manually, so
 * there is nothing here for a room to point at that Room Service's own
 * authorization check wouldn't already accept.
 */
export function RepositoryPicker({ selectedId, onSelect }: RepositoryPickerProps) {
  const [state, setState] = useState<LoadState>("loading");
  const [repositories, setRepositories] = useState<GithubAppRepository[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const status = await getGithubAppStatus();
        if (cancelled) return;

        if (!status.installed) {
          setState("not-installed");
          return;
        }

        const { repositories: repos } = await getGithubAppRepositories();
        if (cancelled) return;

        if (repos.length === 0) {
          setState("no-repositories");
          return;
        }

        setRepositories(repos);
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-6 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading repositories…
      </div>
    );
  }

  if (state === "error") {
    return <p className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger">
      Couldn&apos;t load your repositories. Please try again.
    </p>;
  }

  if (state === "not-installed") {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center">
        <GithubIcon className="mx-auto h-5 w-5 text-muted-2" />
        <p className="mt-2 text-sm font-medium text-foreground">GitHub App not installed</p>
        <p className="mt-1 text-sm text-muted">
          Install the Commit.ly GitHub App to select a repository for this room.
        </p>
        <a
          href={installGithubAppUrl()}
          target="_blank"
          rel="noreferrer"
          className="focus-ring mt-4 inline-flex items-center gap-2 rounded-lg border border-border-strong px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
        >
          Install Commit.ly on GitHub
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
    );
  }

  if (state === "no-repositories") {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted">
        No repositories are currently available to Commit.ly. Grant access from your GitHub App
        installation settings.
      </p>
    );
  }

  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
      {repositories.map((repo, index) => {
        const isSelected = repo.id === selectedId;
        return (
          <button
            key={repo.id}
            type="button"
            onClick={() => onSelect(repo)}
            aria-pressed={isSelected}
            className={`focus-ring flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
              index > 0 ? "border-t border-border" : ""
            } ${isSelected ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
          >
            <FolderGit2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{repo.fullName}</p>
              {repo.defaultBranch && <p className="mt-0.5 text-xs text-muted-2">{repo.defaultBranch}</p>}
            </div>
            {repo.private ? (
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-2" aria-label="Private repository" />
            ) : (
              <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-2" aria-label="Public repository" />
            )}
          </button>
        );
      })}
    </div>
  );
}
