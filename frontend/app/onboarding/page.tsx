"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export default function OnboardingPage() {
  const { status } = useRedirectByAuth({ whenUnauthenticated: "/login", whenCompleteProfile: "/" });
  const { user, setUser } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState<string[]>([]);

  const [identityErrors, setIdentityErrors] = useState<IdentityFieldErrors>({});
  const [aboutErrors, setAboutErrors] = useState<AboutFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const draft = { displayName, username, avatarUrl, bio, role, location, skills };

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
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setFormError("Please check your details and try again.");
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
