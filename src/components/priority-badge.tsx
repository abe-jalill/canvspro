import { cn } from "@/lib/utils";
import type { PriorityUrgency } from "@/lib/get-it-done";

// Quiet, monochrome weight instead of red/amber/blue alarms (see countdown.ts).
const STYLES: Record<PriorityUrgency, { label: string; className: string }> = {
  critical: {
    label: "Do first",
    className: "border-foreground/25 bg-foreground/10 text-foreground",
  },
  high: {
    label: "Soon",
    className: "border-foreground/15 bg-foreground/[0.06] text-foreground/85",
  },
  medium: {
    label: "This week",
    className: "border-foreground/10 bg-foreground/[0.03] text-muted-foreground",
  },
  low: {
    label: "Later",
    className: "border-foreground/10 bg-transparent text-muted-foreground/70",
  },
};

export function PriorityBadge({ urgency }: { urgency: PriorityUrgency }) {
  const { label, className } = STYLES[urgency];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}
