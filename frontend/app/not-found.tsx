"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <ErrorState
        title="404 — This branch doesn't exist."
        description="The page you're looking for was moved, renamed, or never existed."
        onBack={() => router.back()}
      />
    </div>
  );
}
