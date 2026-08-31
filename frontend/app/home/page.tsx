"use client";

import { useRedirectByAuth } from "@/lib/auth/useRedirectByAuth";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { ProductPreview } from "@/components/landing/ProductPreview";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function HomePage() {
  useRedirectByAuth({ whenAuthenticated: "/" });

  return (
    <div className="flex-1 overflow-x-hidden bg-background">
      <Navbar />
      <main>
        <Hero />
        <ProductPreview />
        <Features />
        <HowItWorks />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
