import { ArrowDown } from "lucide-react";

export function NewMessagesButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring absolute bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-accent to-accent-2 px-4 py-2 text-sm font-semibold text-accent-foreground shadow-lg transition-transform hover:scale-[1.03]"
    >
      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
      New messages
    </button>
  );
}
