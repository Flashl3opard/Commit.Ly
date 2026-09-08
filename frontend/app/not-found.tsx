"use client";

import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";
import { CommitlyCatLottie } from "@/components/ui/CommitlyCatLottie";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <ErrorState
        title="404 — This branch doesn't exist."
        description="The page you're looking for was moved, renamed, or never existed."
        onBack={() => router.back()}
        icon={<CommitlyCatLottie className="h-36 w-36" />}
      />
    </div>
  );
}
