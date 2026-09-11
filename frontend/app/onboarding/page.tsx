"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { updateCurrentUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { ProfilePreviewCard } from "@/components/onboarding/ProfilePreviewCard";
import { StepIdentity, type IdentityFieldErrors } from "@/components/onboarding/StepIdentity";
import { StepAbout, MAX_BIO_LENGTH, type AboutFieldErrors } from "@/components/onboarding/StepAbout";
import { StepSkills } from "@/components/onboarding/StepSkills";
import { StepGithub } from "@/components/onboarding/StepGithub";
import { StepReview } from "@/components/onboarding/StepReview";

const STEP_COUNT = 5;

const DRAFT_STORAGE_KEY = "commitly-onboarding-draft";

type OnboardingDraft = {
  step: number;
  displayName: string;
  username: string;
  avatarUrl: string;
  bio: string;
  role: string;
  location: string;
  skills: string[];
};

/**
 * Connecting GitHub (StepGithub) is a real full-page navigation away to
 * GitHub's OAuth consent screen and back — every in-memory useState value
 * on this page is lost on that round trip, since the whole app remounts
 * from scratch. Persisting the draft to sessionStorage (not localStorage —
 * this is scoped to finishing the current onboarding attempt, not
 * something that should survive into a future session) means returning
 * from GitHub restores exactly what was typed before leaving, instead of
 * silently discarding it.
 */
function loadDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: OnboardingDraft): void {
  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Best-effort — a storage failure (private browsing, quota) just means
    // the GitHub round-trip won't restore the draft; it's not fatal.
  }
}

function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Same reasoning as saveDraft.
  }
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const FIELD_LABELS: Record<string, string> = {
  displayName: "Display name",
  username: "Username",
  avatarUrl: "Avatar URL",
  bio: "Bio",
  role: "Role",
  location: "Location",
  skills: "Skills",
};

/**
 * PATCH /users/me's 400 response carries Zod's flatten() shape
 * ({ fieldErrors: Record<string, string[]> }) — this turns that into a
 * specific, actionable message (e.g. "Avatar URL: Invalid url") instead
 * of the generic "check your details" text that gave no clue which field
 * was actually wrong.
 */
function describeValidationError(err: ApiError): string | null {
  const details = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
  const fieldErrors = details?.fieldErrors;
  if (!fieldErrors) return null;

  const messages = Object.entries(fieldErrors)
    .filter(([, msgs]) => msgs.length > 0)
    .map(([field, msgs]) => `${FIELD_LABELS[field] ?? field}: ${msgs[0]}`);

  return messages.length > 0 ? messages.join(" ") : null;
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageContent />
    </Suspense>
  );
}

function OnboardingPageContent() {
  const { status } = useRedirectByAuth({ whenUnauthenticated: "/login", whenCompleteProfile: "/" });
  const { user, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Returning from the GitHub OAuth redirect lands back here with a fresh
  // mount — the saved draft (see loadDraft above) restores whatever was
  // typed across every earlier step, not just which step to resume on.
  const savedDraft = loadDraft();
  const [step, setStep] = useState(() => savedDraft?.step ?? (searchParams.get("github") ? 3 : 0));
  const [displayName, setDisplayName] = useState(() => savedDraft?.displayName ?? user?.displayName ?? "");
  const [username, setUsername] = useState(() => savedDraft?.username ?? user?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(() => savedDraft?.avatarUrl ?? user?.avatarUrl ?? "");
  const [bio, setBio] = useState(() => savedDraft?.bio ?? user?.bio ?? "");
  const [role, setRole] = useState(() => savedDraft?.role ?? user?.role ?? "");
  const [location, setLocation] = useState(() => savedDraft?.location ?? user?.location ?? "");
  const [skills, setSkills] = useState<string[]>(() => savedDraft?.skills ?? user?.skills ?? []);

  const [identityErrors, setIdentityErrors] = useState<IdentityFieldErrors>({});
  const [aboutErrors, setAboutErrors] = useState<AboutFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const draft = { displayName, username, avatarUrl, bio, role, location, skills };

  useEffect(() => {
    saveDraft({ step, ...draft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, displayName, username, avatarUrl, bio, role, location, skills]);

  function validateIdentity(): IdentityFieldErrors {
    const errors: IdentityFieldErrors = {};
    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim();
    const trimmedAvatarUrl = avatarUrl.trim();

    if (!trimmedName) {
      errors.displayName = "Enter a display name.";
    } else if (trimmedName.length > 64) {
      errors.displayName = "Display name must be 64 characters or fewer.";
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 32) {
      errors.username = "Username must be 3-32 characters.";
    }

    if (trimmedAvatarUrl && !isValidUrl(trimmedAvatarUrl)) {
      errors.avatarUrl = "Enter a valid URL.";
    }

    return errors;
  }

  function validateAbout(): AboutFieldErrors {
    const errors: AboutFieldErrors = {};

    if (bio.length > MAX_BIO_LENGTH) {
      errors.bio = `Bio must be ${MAX_BIO_LENGTH} characters or fewer.`;
    }
    if (role.trim().length > 64) {
      errors.role = "Role must be 64 characters or fewer.";
    }
    if (location.trim().length > 64) {
      errors.location = "Location must be 64 characters or fewer.";
    }

    return errors;
  }

  function goNext() {
    if (step === 0) {
      const errors = validateIdentity();
      setIdentityErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    if (step === 1) {
      const errors = validateAbout();
      setAboutErrors(errors);
      if (Object.keys(errors).length > 0) return;
    }
    setFormError(null);
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
  }

  function goBack() {
    setFormError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleComplete() {
    setFormError(null);
    setSubmitting(true);
    try {
      const { user: updatedUser } = await updateCurrentUser({
        displayName: displayName.trim(),
        username: username.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        bio: bio.trim() || undefined,
        role: role.trim() || undefined,
        location: location.trim() || undefined,
        skills,
      });
      setUser(updatedUser);
      clearDraft();
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setFormError(describeValidationError(err) ?? "Please check your details and try again.");
        } else if (err.status === 409) {
          setFormError(err.message);
          setStep(0);
        } else if (err.status === 401) {
          router.replace("/login");
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

  if (status === "loading" || status === "unauthenticated" || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-strong border-t-accent" />
      </div>
    );
  }

  return (
    <OnboardingLayout step={step} preview={<ProfilePreviewCard draft={draft} />}>
      {step === 0 && (
        <StepIdentity
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          onDisplayNameChange={setDisplayName}
          onUsernameChange={setUsername}
          onAvatarUrlChange={setAvatarUrl}
          errors={identityErrors}
          disabled={submitting}
        />
      )}
      {step === 1 && (
        <StepAbout
          bio={bio}
          role={role}
          location={location}
          onBioChange={setBio}
          onRoleChange={setRole}
          onLocationChange={setLocation}
          errors={aboutErrors}
          disabled={submitting}
        />
      )}
      {step === 2 && <StepSkills skills={skills} onChange={setSkills} disabled={submitting} />}
      {step === 3 && <StepGithub />}
      {step === 4 && <StepReview draft={draft} />}

      <AnimatePresence mode="wait">
        {formError && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-5 rounded-lg border border-danger-border bg-danger-bg px-3.5 py-2.5 text-sm text-danger"
          >
            {formError}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || submitting}
          className="focus-ring rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {step < STEP_COUNT - 1 ? (
          <button
            type="button"
            onClick={goNext}
            className="focus-ring rounded-lg bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01]"
          >
            {step === 3 ? "Skip for now" : "Next"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleComplete}
            disabled={submitting}
            className="focus-ring rounded-lg bg-linear-to-r from-accent to-accent-2 px-5 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
          >
            {submitting ? "Completing…" : "Complete Profile"}
          </button>
        )}
      </div>
    </OnboardingLayout>
  );
}
