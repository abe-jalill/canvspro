import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompleteToggle({
  done,
  onToggle,
  label,
  className,
  disabled = false,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
  /** True while the saved list is still loading — prevents a lost write. */
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={done ? `Mark ${label} incomplete` : `Mark ${label} complete`}
      aria-pressed={done}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
        disabled && "cursor-wait opacity-50",
        done
          ? "border-foreground/60 bg-foreground/80 text-background"
          : "border-foreground/30 text-transparent hover:border-foreground/60 hover:text-foreground/60",
        className,
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}
