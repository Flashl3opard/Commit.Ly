import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

export type ActivityAccent = "accent" | "success" | "muted" | "danger";

const ACCENT_CLASSES: Record<ActivityAccent, string> = {
  accent: "bg-accent-soft text-accent",
  success: "bg-success-bg text-success",
  muted: "bg-background-3 text-muted-2",
  danger: "bg-danger-bg text-danger",
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
  emphasisMarker?: boolean;
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
  emphasisMarker,
}: ActivityCardShellProps) {
  return (
    <div className="relative mx-4 mt-3 flex gap-3">
      {railPosition !== "none" && (
        <div
          className={`absolute left-[15px] w-px bg-accent-soft ${
            railPosition === "start" ? "top-8 bottom-0" : "top-0 bottom-0"
          }`}
          aria-hidden="true"
        />
      )}
      <span
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ACCENT_CLASSES[accent]}`}
      >
        {icon}
      </span>
      <div
        className={`min-w-0 flex-1 rounded-lg border border-border bg-background-2 px-3.5 py-2.5 ${
          emphasisMarker ? "border-l-2 border-l-danger" : ""
        }`}
      >
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold tracking-wide text-muted-2 uppercase">{label}</p>
          {badge && (
            <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${BADGE_CLASSES[accent]}`}>
              {badge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-foreground">{headline}</p>
        {secondary && <p className="mt-0.5 truncate text-sm text-muted">{secondary}</p>}
        {linkHref && linkLabel && (
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
          >
            {linkLabel}
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}
