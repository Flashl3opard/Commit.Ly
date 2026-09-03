"use client";

import { useEffect } from "react";
import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { WhyCommitly } from "@/components/landing/WhyCommitly";
import { PlatformSection } from "@/components/landing/PlatformSection";
import { FinalCta } from "@/components/landing/FinalCta";
import { LandingFooter } from "@/components/landing/LandingFooter";

/**
 * /home is a fixed dark cinematic identity, independent of the app-wide
 * light/dark preference — forces data-theme="dark" while mounted and
 * restores whatever the user had set once they navigate away.
 */
function useLockedDarkTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-theme");
    root.setAttribute("data-theme", "dark");
    return () => {
      if (previous) {
        root.setAttribute("data-theme", previous);
      } else {
        root.removeAttribute("data-theme");
      }
    };
  }, []);
}

export default function HomePage() {
  useRedirectByAuth({ whenAuthenticated: "/" });
  useLockedDarkTheme();

  return (
    <div className="flex-1 overflow-x-hidden bg-background">
      <LandingNavbar />
      <main>
        <HeroSection />
        <WhyCommitly />
        <PlatformSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
