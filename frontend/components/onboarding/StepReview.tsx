"use client";

import { ProfilePreviewCard, type ProfileDraft } from "./ProfilePreviewCard";

export function StepReview({ draft }: { draft: ProfileDraft }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Review your profile.</h1>
      <p className="mt-2 text-sm text-muted">This is what your team will see. You can always edit it later.</p>

      <div className="mt-8 lg:hidden">
        <ProfilePreviewCard draft={draft} />
      </div>
    </div>
  );
}
