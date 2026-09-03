"use client";

import { GithubConnectionSection } from "@/components/profile/GithubConnectionSection";

export function StepGithub() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Connect your GitHub.</h1>
      <p className="mt-2 text-sm text-muted">
        Connect GitHub to verify your developer identity and unlock GitHub-powered Commit.ly features.
      </p>

      <div className="mt-8">
        <GithubConnectionSection returnTo="onboarding" />
      </div>
    </div>
  );
}
