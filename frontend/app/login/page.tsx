"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { login } from "@/lib/api/auth";
import { getCurrentUser } from "@/lib/api/users";
import { ApiError } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginVisual } from "@/components/auth/LoginVisual";
import { FormField } from "@/components/ui/FormField";

export default function LoginPage() {
  const { status } = useRedirectByAuth({ whenIncompleteProfile: "/onboarding", whenCompleteProfile: "/" });
  const { markAuthenticated } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim() || !password) {
      setFormError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });

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
        // Login succeeded even if this follow-up lookup fails;
        // AuthProvider will resolve the real state on next render.
      }

      router.replace(profileCompleted ? "/" : "/onboarding");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError("Invalid email or password");
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
      title="Sign in"
      subtitle={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </>
      }
      side={<LoginVisual />}
      sidePosition="left"
    >
      <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-5">
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Password
            </label>
            <span className="cursor-not-allowed text-xs text-muted-2" title="Coming soon">
              Forgot password?
            </span>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="focus-ring mt-1.5 w-full rounded-lg border border-border bg-background-2/60 px-3.5 py-2.5 text-sm text-foreground focus:border-accent"
          />
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
        </AnimatePresence>

        <button
          type="submit"
          disabled={submitting}
          className="focus-ring w-full rounded-lg bg-linear-to-r from-accent to-accent-2 px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-transform hover:scale-[1.01] disabled:opacity-60 disabled:hover:scale-100"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
