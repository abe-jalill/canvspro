import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function CompleteToggle({
  done,
  onToggle,
  label,
  className,
}: {
  done: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={done ? `Mark ${label} incomplete` : `Mark ${label} complete`}
      aria-pressed={done}
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
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
