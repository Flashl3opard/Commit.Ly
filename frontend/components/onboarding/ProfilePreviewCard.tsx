"use client";

import { UserAvatar } from "@/components/ui/UserAvatar";

export type ProfileDraft = {
  displayName: string;
  username: string;
  avatarUrl: string;
  bio: string;
  role: string;
  location: string;
  skills: string[];
};

export function ProfilePreviewCard({ draft }: { draft: ProfileDraft }) {
  const displayName = draft.displayName.trim() || "Your name";
  const username = draft.username.trim() || "username";

  return (
    <div className="glass-panel relative overflow-hidden rounded-2xl p-8 shadow-2xl">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 400px 240px at 50% 0%, rgba(34,211,238,0.1), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col items-center text-center">
        <UserAvatar avatarUrl={draft.avatarUrl.trim() || null} username={username} size="xl" />

        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">{displayName}</h3>
        <p className="text-sm text-muted-2">@{username}</p>

        {draft.bio.trim() && <p className="mt-3 max-w-xs text-sm text-muted">{draft.bio.trim()}</p>}

        {(draft.role.trim() || draft.location.trim()) && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-2">
            {draft.role.trim() && <span>{draft.role.trim()}</span>}
            {draft.role.trim() && draft.location.trim() && <span aria-hidden="true">·</span>}
            {draft.location.trim() && <span>{draft.location.trim()}</span>}
          </div>
        )}

        {draft.skills.length > 0 && (
          <div className="mt-5 flex flex-wrap justify-center gap-1.5">
            {draft.skills.map((skill) => (
              <span
                key={skill}
                className="rounded-full border border-border-strong px-2.5 py-1 font-mono text-xs text-accent"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
