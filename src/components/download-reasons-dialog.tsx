import { useMemo, useState } from "react";
import {
  AlarmClock,
  Calculator,
  CalendarRange,
  Check,
  LayoutGrid,
  Leaf,
  Megaphone,
  Scale,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DOWNLOAD_REASONS, recommendWidgets } from "@/lib/download-reasons";
import type { WidgetId } from "@/lib/dashboard-layout";
import { WIDGETS } from "@/components/widgets/dashboard-widgets";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  deadlines: AlarmClock,
  grades: TrendingUp,
  plan: CalendarRange,
  procrastination: Zap,
  study: Timer,
  overview: LayoutGrid,
  announcements: Megaphone,
  balance: Scale,
  gpa: Calculator,
  stress: Leaf,
};

/**
 * "Why did you download CoursePro?" Asked once, after Canvas is connected
 * (the dashboard only opens then). The answers set up the dashboard; Customize
 * dashboard changes it later. The iPhone app asks the same.
 */
export function DownloadReasonsDialog({
  open,
  order,
  onDone,
}: {
  open: boolean;
  order: WidgetId[];
  /** The answers and the cards they chose (empty answers: the cards shown now). */
  onDone: (reasons: string[], widgets: WidgetId[] | null) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const plan = useMemo(() => recommendWidgets([...picked], order), [picked, order]);

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-xl [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-tight">
            Why did you download CoursePro?
          </DialogTitle>
          <DialogDescription>
            Pick any that fit. This is used to customize your dashboard, and you can change it any
            time.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Reasons">
          {DOWNLOAD_REASONS.map((reason) => {
            const on = picked.has(reason.id);
            const Icon = ICONS[reason.id] ?? Check;
            return (
              <li key={reason.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(reason.id)}
                  className={cn(
                    "press flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    on
                      ? "border-primary/70 bg-primary/10 text-foreground"
                      : "border-foreground/15 text-foreground/90 hover:border-foreground/30",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
                      on
                        ? "bg-primary text-primary-foreground"
                        : "bg-foreground/[0.06] text-muted-foreground",
                    )}
                  >
                    {on ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1 font-medium leading-snug">{reason.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* What the answers will put on the dashboard, as they're picked. */}
        <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
          {picked.size > 0 && (
            <>
              Your dashboard:{" "}
              <span className="text-foreground">
                {plan.map((id) => WIDGETS[id].label).join(", ")}
              </span>
            </>
          )}
        </p>

        {/* Kept in view on a phone, where the answers scroll. */}
        <div className="sticky -bottom-6 -mx-6 space-y-2 bg-background px-6 pb-2 pt-2">
          <button
            type="button"
            disabled={picked.size === 0}
            onClick={() => onDone([...picked], plan)}
            className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            Set up my dashboard
          </button>
          <button
            type="button"
            onClick={() => onDone([], null)}
            className="min-h-10 w-full rounded-xl text-sm text-muted-foreground hover:text-foreground"
          >
            Skip for now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
