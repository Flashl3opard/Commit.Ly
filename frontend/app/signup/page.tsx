"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { register } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { BranchVisual } from "@/components/auth/BranchVisual";
import { FormField } from "@/components/ui/FormField";

type FieldErrors = Partial<Record<"username" | "email" | "password" | "confirmPassword", string>>;

function validate(values: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): FieldErrors {
  const errors: FieldErrors = {};

  if (!values.username.trim()) {
    errors.username = "Username is required.";
  } else if (values.username.trim().length < 3 || values.username.trim().length > 32) {
    errors.username = "Username must be 3-32 characters.";
  }

  if (!values.email.trim()) {
    errors.email = "Email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!values.password) {
    errors.password = "Password is required.";
  } else if (values.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (values.confirmPassword !== values.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}

export default function SignupPage() {
  const { status } = useRedirectByAuth({ whenIncompleteProfile: "/onboarding", whenCompleteProfile: "/" });
  const { markAuthenticated } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const errors = validate({ username, email, password, confirmPassword });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await register({ username: username.trim(), email: email.trim(), password });

      let profileCompleted = false;
      try {
        const { user } = await getCurrentUser();
        // Sets user and status together so the destination page's own
        // useRedirectByAuth sees a consistent authenticated state on its
        // very first render, instead of a stale "unauthenticated" status
        // racing against a freshly-set user.
        markAuthenticated(user);
        profileCompleted = user.profileCompleted;
      } catch {
        // Registration succeeded even if this follow-up lookup fails;
        // AuthProvider will resolve the real state on next render.
      }

      router.replace(profileCompleted ? "/" : "/onboarding");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setFormError("Please check the highlighted fields and try again.");
        } else if (err.status === 409) {
          setFormError(err.message);
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

  if (status === "loading" || status === "authenticated") {
    return null;
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
      side={<BranchVisual />}
    >
      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
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
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          error={fieldErrors.email}
        />

        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          error={fieldErrors.password}
        />

        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
          error={fieldErrors.confirmPassword}
        />

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
        </AnimatePresence>

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring w-full rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
