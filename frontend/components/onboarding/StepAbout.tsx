"use client";

import { FormField } from "@/components/ui/FormField";

export const MAX_BIO_LENGTH = 160;

export type AboutFieldErrors = Partial<Record<"bio" | "role" | "location", string>>;

export function StepAbout({
  bio,
  role,
  location,
  onBioChange,
  onRoleChange,
  onLocationChange,
  errors,
  disabled,
}: {
  bio: string;
  role: string;
  location: string;
  onBioChange: (value: string) => void;
  onRoleChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  errors: AboutFieldErrors;
  disabled: boolean;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Tell your team a little about yourself.
      </h1>
      <p className="mt-2 text-sm text-muted">Everything here is optional — add what feels useful.</p>

      <div className="mt-8 space-y-5">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="bio" className="block text-sm font-medium text-foreground">
              Bio
            </label>
            <span className="text-xs text-muted-2">
              {bio.length} / {MAX_BIO_LENGTH}
            </span>
          </div>
          <textarea
            id="bio"
            rows={3}
            placeholder="A short line about what you build"
            value={bio}
            onChange={(e) => onBioChange(e.target.value.slice(0, MAX_BIO_LENGTH))}
            disabled={disabled}
            className="focus-ring mt-1.5 w-full resize-none rounded-lg border border-border bg-background-2/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 focus:border-accent"
          />
          {errors.bio && <p className="mt-1.5 text-sm text-danger">{errors.bio}</p>}
        </div>

        <FormField
          id="role"
          label="Role (optional)"
          type="text"
          placeholder="Enter your role or title"
          value={role}
          onChange={(e) => onRoleChange(e.target.value)}
          disabled={disabled}
          error={errors.role}
          maxLength={64}
        />

        <FormField
          id="location"
          label="Location (optional)"
          type="text"
          placeholder="Enter your city and country"
          value={location}
          onChange={(e) => onLocationChange(e.target.value)}
          disabled={disabled}
          error={errors.location}
          maxLength={64}
        />
      </div>
    </div>
  );
}
