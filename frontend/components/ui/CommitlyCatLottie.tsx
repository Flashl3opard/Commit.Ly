"use client";

import { Lottie } from "lottie-react";
import loaderCatAnimation from "@/public/loader-cat.json";

/**
 * The animated counterpart to CommitlyCat, reserved for the 404 page only
 * — the one exception state visitors hit most often and where a little
 * personality earns its place. Every other ErrorState usage (403/500/
 * network/GitHub failure/room-not-found) keeps the calmer static mark,
 * since those read as "something is actually wrong" rather than "you
 * wandered off the map."
 */
export function CommitlyCatLottie({ className = "h-32 w-32" }: { className?: string }) {
  return (
    <div className={`${className} overflow-hidden`} aria-hidden="true">
      <Lottie src={loaderCatAnimation} loop autoplay style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
