"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { updateCurrentUser } from "@/lib/api/users";
import { ApiError, type UpdateProfileInput } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { FormField } from "@/components/ui/FormField";
import { SkillsPicker } from "@/components/ui/SkillsPicker";

type FieldErrors = Partial<
  Record<"displayName" | "username" | "avatarUrl" | "bio" | "role" | "location" | "customStatus", string>
>;

const MAX_STATUS_LENGTH = 120;
const MAX_BIO_LENGTH = 160;

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export default function EditProfilePage() {
  const { user, setUser } = useAuth();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName ?? "");
      setUsername(user.username);
      setAvatarUrl(user.avatarUrl ?? "");
      setBio(user.bio ?? "");
      setRole(user.role ?? "");
      setLocation(user.location ?? "");
      setCustomStatus(user.customStatus ?? "");
      setSkills(user.skills);
    }
  }, [user]);

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    const trimmedDisplayName = displayName.trim();
    const trimmedUsername = username.trim();
    const trimmedAvatarUrl = avatarUrl.trim();
    const trimmedStatus = customStatus.trim();

    if (!trimmedDisplayName) {
      errors.displayName = "Display name is required.";
    } else if (trimmedDisplayName.length > 64) {
      errors.displayName = "Display name must be 64 characters or fewer.";
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
      errors.username = "Username must be 3-32 characters.";
    }

    if (trimmedAvatarUrl && !isValidUrl(trimmedAvatarUrl)) {
      errors.avatarUrl = "Enter a valid URL.";
    }

    if (bio.length > MAX_BIO_LENGTH) {
      errors.bio = `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`;
    }

    if (role.trim().length > 64) {
      errors.role = "Role must be 64 characters or fewer.";
    }

    if (location.trim().length > 64) {
      errors.location = "Location must be 64 characters or fewer.";
    }

    if (trimmedStatus.length > MAX_STATUS_LENGTH) {
      errors.customStatus = `Status must be ${MAX_STATUS_LENGTH} characters or fewer.`;
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !user) {
      return;
    }

    const trimmedDisplayName = displayName.trim();
    const trimmedUsername = username.trim();
    const trimmedAvatarUrl = avatarUrl.trim();
    const trimmedBio = bio.trim();
    const trimmedRole = role.trim();
    const trimmedLocation = location.trim();
    const trimmedStatus = customStatus.trim();

    const payload: UpdateProfileInput = {};
    if (trimmedDisplayName !== (user.displayName ?? "")) {
      payload.displayName = trimmedDisplayName;
    }
    if (trimmedUsername !== user.username) {
      payload.username = trimmedUsername;
    }
    if (trimmedAvatarUrl !== (user.avatarUrl ?? "")) {
      payload.avatarUrl = trimmedAvatarUrl;
    }
    if (trimmedBio !== (user.bio ?? "")) {
      payload.bio = trimmedBio;
    }
    if (trimmedRole !== (user.role ?? "")) {
      payload.role = trimmedRole;
    }
    if (trimmedLocation !== (user.location ?? "")) {
      payload.location = trimmedLocation;
    }
    if (trimmedStatus !== (user.customStatus ?? "")) {
      payload.customStatus = trimmedStatus;
    }
    if (JSON.stringify(skills) !== JSON.stringify(user.skills)) {
      payload.skills = skills;
    }

    if (Object.keys(payload).length === 0) {
      router.replace("/profile");
      return;
    }

    setSubmitting(true);
    try {
      const { user: updatedUser } = await updateCurrentUser(payload);
      setUser(updatedUser);
      setSuccessMessage("Profile updated.");
      setTimeout(() => router.replace("/profile"), 600);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setFormError("Please check the highlighted fields and try again.");
        } else if (err.status === 409) {
          setFieldErrors((prev) => ({ ...prev, username: err.message }));
        } else if (err.status === 401) {
          router.replace("/home");
        } else {
          setFormError("Something went wrong. Please try again.");
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      {user && (
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="glass-panel rounded-2xl p-8">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Edit profile</h1>
            <p className="mt-1.5 text-sm text-muted">Update the fields you want to change.</p>

            <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
              <FormField
                id="displayName"
                label="Display name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={submitting}
                error={fieldErrors.displayName}
                maxLength={64}
              />

              <FormField
                id="username"
                label="Username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                error={fieldErrors.username}
              />

              <FormField
                id="avatarUrl"
                label="Avatar URL"
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                disabled={submitting}
                error={fieldErrors.avatarUrl}
              />

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
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, MAX_BIO_LENGTH))}
                  disabled={submitting}
                  className="focus-ring mt-1.5 w-full resize-none rounded-lg border border-border bg-background-2/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-2 focus:border-accent"
                />
                {fieldErrors.bio && <p className="mt-1.5 text-sm text-danger">{fieldErrors.bio}</p>}
              </div>

              <FormField
                id="role"
                label="Role"
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Enter your role or title"
                disabled={submitting}
                error={fieldErrors.role}
                maxLength={64}
              />

              <FormField
                id="location"
                label="Location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter your city and country"
                disabled={submitting}
                error={fieldErrors.location}
                maxLength={64}
              />

              <FormField
                id="customStatus"
                label="Custom status"
                type="text"
                value={customStatus}
                onChange={(e) => setCustomStatus(e.target.value)}
                placeholder="Building Commit.ly"
                maxLength={MAX_STATUS_LENGTH}
                disabled={submitting}
                error={fieldErrors.customStatus}
              />

              <div>
                <label className="block text-sm font-medium text-foreground">Skills</label>
                <div className="mt-1.5">
                  <SkillsPicker selected={skills} onChange={setSkills} disabled={submitting} />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {formError && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm text-danger"
                  >
                    {formError}
                  </motion.p>
                )}
                {successMessage && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-success-border bg-success-bg px-3.5 py-2.5 text-sm text-success"
                  >
                    {successMessage}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="focus-ring flex-1 rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
                >
                  {submitting ? "Saving…" : "Save changes"}
                </button>
                <Link
                  href="/profile"
                  className="focus-ring rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </main>
      )}
    </AppShell>
  );
}
