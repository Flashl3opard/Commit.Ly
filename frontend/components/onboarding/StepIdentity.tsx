"use client";

import { FormField } from "@/components/ui/FormField";
import { UserAvatar } from "@/components/ui/UserAvatar";

export type IdentityFieldErrors = Partial<Record<"displayName" | "username" | "avatarUrl", string>>;

export function StepIdentity({
  displayName,
  username,
  avatarUrl,
  onDisplayNameChange,
  onUsernameChange,
  onAvatarUrlChange,
  errors,
  disabled,
}: {
  displayName: string;
  username: string;
  avatarUrl: string;
  onDisplayNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onAvatarUrlChange: (value: string) => void;
  errors: IdentityFieldErrors;
  disabled: boolean;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Let&apos;s build your developer profile.
      </h1>
      <p className="mt-2 text-sm text-muted">This is how your team will recognize you on Commit.ly.</p>

      <div className="mt-8 flex items-center gap-4">
        <UserAvatar avatarUrl={avatarUrl.trim() || null} username={username || displayName || "?"} size="lg" />
        <p className="text-xs text-muted-2">
          Add an avatar URL below, or keep the default Commit.ly avatar.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <FormField
          id="displayName"
          label="Display name"
          type="text"
          placeholder="Enter your name"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          disabled={disabled}
          error={errors.displayName}
          maxLength={64}
        />

        <FormField
          id="username"
          label="Username"
          type="text"
          placeholder="Choose a username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          disabled={disabled}
          error={errors.username}
          maxLength={32}
        />

        <FormField
          id="avatarUrl"
          label="Avatar URL (optional)"
          type="text"
          placeholder="https://example.com/avatar.png"
          value={avatarUrl}
          onChange={(e) => onAvatarUrlChange(e.target.value)}
          disabled={disabled}
          error={errors.avatarUrl}
        />
      </div>
    </div>
  );
}
