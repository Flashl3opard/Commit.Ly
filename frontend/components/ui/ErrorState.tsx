import type { ReactNode } from "react";
import { RefreshCw, ArrowLeft, type LucideIcon } from "lucide-react";
import { CommitlyCat } from "./CommitlyCat";

export type ErrorStateAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  icon?: LucideIcon;
};

type ErrorStateProps = {
  title: string;
  description?: string;
  onRetry?: () => void;
  onBack?: () => void;
  actions?: ErrorStateAction[];
  /** Fills the parent (flex-1, centered) — the default for a full-pane state. Set false for a compact inline usage (e.g. inside a smaller panel). */
  fill?: boolean;
  /** Overrides the default static CommitlyCat mark — reserved for 404 (CommitlyCatLottie), which is the one state that earns a bit of animated personality. Every other state stays the calmer static icon. */
  icon?: ReactNode;
};

/**
 * The one shared shell for every exception/empty state in the app —
 * 404/403/500/service-unavailable/network/GitHub-failure/room-not-found —
 * so they all read as the same premium, consistent system rather than
 * ad-hoc per-page markup. Copy stays short, developer-aware, and never
 * exposes stack traces, internal URLs, or other implementation detail;
 * callers pass only a user-safe title/description.
 */
export function ErrorState({ title, description, onRetry, onBack, actions, fill = true, icon }: ErrorStateProps) {
  const allActions: ErrorStateAction[] = [
    ...(onRetry ? [{ label: "Try again", onClick: onRetry, variant: "primary" as const, icon: RefreshCw }] : []),
    ...(onBack ? [{ label: "Go back", onClick: onBack, variant: "secondary" as const, icon: ArrowLeft }] : []),
    ...(actions ?? []),
  ];

  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${fill ? "flex-1" : "py-10"}`}>
      {icon ?? <CommitlyCat className="h-11 w-11 opacity-70 grayscale" />}
      <h1 className="mt-4 text-base font-semibold text-foreground">{title}</h1>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {allActions.length > 0 && (
        <div className="mt-5 flex items-center gap-2">
          {allActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                className={
                  action.variant === "primary"
                    ? "focus-ring inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-background-3"
                    : "focus-ring inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
                }
              >
                {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                {action.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
