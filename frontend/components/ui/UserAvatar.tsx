"use client";

import { useState } from "react";
import Image from "next/image";

type AvatarSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 88,
};

const SIZE_TEXT: Record<AvatarSize, string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-xl",
};

export type UserAvatarProps = {
  avatarUrl: string | null | undefined;
  username: string;
  size?: AvatarSize;
  className?: string;
};

function isLikelyValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Renders the user's avatar, or a Commit.ly-branded default (never a random
 * stock avatar service) when avatarUrl is missing or fails to load.
 */
export function UserAvatar({ avatarUrl, username, size = "md", className = "" }: UserAvatarProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const px = SIZE_PX[size];
  const hasValidUrl = Boolean(avatarUrl && isLikelyValidUrl(avatarUrl));

  if (hasValidUrl && !loadFailed) {
    return (
      <Image
        src={avatarUrl as string}
        alt={`${username}'s avatar`}
        width={px}
        height={px}
        unoptimized
        onError={() => setLoadFailed(true)}
        className={`shrink-0 rounded-full border border-border-strong object-cover ${className}`}
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`${username}'s avatar`}
      className={`relative flex shrink-0 items-center justify-center rounded-full border border-border-strong bg-linear-to-br from-background-3 to-background-2 font-mono font-semibold text-accent shadow-[0_0_16px_rgba(34,211,238,0.14)] ${SIZE_TEXT[size]} ${className}`}
      style={{ width: px, height: px }}
    >
      .ly
    </div>
  );
}
