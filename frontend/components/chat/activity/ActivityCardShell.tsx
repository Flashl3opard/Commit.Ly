import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { GithubIcon } from "@/components/ui/GithubIcon";

export type ActivityAccent = "accent" | "success" | "muted" | "danger";

// Flat icon color only — no tinted circular fill behind it. A bot-message
// row should read as compact metadata, not a second chat bubble; the
// left border (ACCENT_BORDER_CLASSES) is what actually carries the color
// signal at a glance, the icon is secondary confirmation.
const ICON_CLASSES: Record<ActivityAccent, string> = {
  accent: "text-accent",
  success: "text-success",
  muted: "text-muted-2",
  danger: "text-danger",
};

const ACCENT_BORDER_CLASSES: Record<ActivityAccent, string> = {
  accent: "border-l-accent",
  success: "border-l-success",
  muted: "border-l-border-strong",
  danger: "border-l-danger",
};

const BADGE_CLASSES: Record<ActivityAccent, string> = {
  accent: "border-border-strong text-accent",
  success: "border-success-border text-success",
  muted: "border-border text-muted-2",
  danger: "border-danger-border text-danger",
};

type ActivityCardShellProps = {
  icon: ReactNode;
  accent: ActivityAccent;
  label: string;
  headline: string;
  secondary?: string;
  badge?: string;
  linkHref?: string | null;
  linkLabel?: string;
  railPosition: "none" | "start" | "middle";
};

export function ActivityCardShell({
  icon,
  accent,
  label,
  headline,
  secondary,
  badge,
  linkHref,
  linkLabel,
  railPosition,
}: ActivityCardShellProps) {
  return (
    <div className="relative mx-4 mt-2.5 flex gap-3">
      {railPosition !== "none" && (
        <div
          className={`absolute left-[15px] w-px bg-border-strong ${
            railPosition === "start" ? "top-7 bottom-0" : "top-0 bottom-0"
          }`}
          aria-hidden="true"
        />
      )}
      <span
        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background-2 ${ICON_CLASSES[accent]}`}
      >
        {icon}
      </span>
      <div
        className={`min-w-0 flex-1 rounded-md border border-border border-l-2 bg-background-2 px-3 py-2 ${ACCENT_BORDER_CLASSES[accent]}`}
      >
        <div className="flex items-center gap-1.5">
          <GithubIcon className="h-3 w-3 shrink-0 text-muted-2" />
          <p className="text-[10.5px] font-semibold tracking-wide text-muted-2 uppercase">{label}</p>
          {badge && (
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${BADGE_CLASSES[accent]}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-foreground">{headline}</p>
        {secondary && <p className="mt-0.5 truncate text-sm text-muted">{secondary}</p>}
        {linkHref && linkLabel && (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-foreground hover:underline"
          >
            {linkLabel}
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
