import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WidgetId } from "@/lib/dashboard-layout";

/** What each widget shows, in the student's words. Same wording as the iPhone app. */
const WIDGET_DETAILS: Record<WidgetId, { title: string; detail: string }> = {
  digest: {
    title: "Since your last visit",
    detail: "New grades, new posts and anything that just became urgent.",
  },
  classes: { title: "Classes & Grades", detail: "Each class and its current grade." },
  upcoming: { title: "Upcoming", detail: "Everything due this week, by class." },
  focus: { title: "Next 48 hours", detail: "What's due in the next two days." },
  calendar: { title: "Calendar", detail: "Canvas events in the week ahead." },
  announcements: { title: "Announcements", detail: "Recent posts from your classes." },
  gpa: { title: "GPA", detail: "An estimate from current scores and the credits you enter." },
  heatmap: { title: "Workload", detail: "How busy each day of the week is." },
};

/**
 * "What do you want on your dashboard?" Asked once per account (the iPhone app
 * asks the same question and shares the answer unless that's turned off there).
 */
export function DashboardWidgetPicker({
  open,
  order,
  initial,
  onSave,
}: {
  open: boolean;
  order: WidgetId[];
  initial: WidgetId[];
  onSave: (picks: WidgetId[]) => void;
}) {
  const [picks, setPicks] = useState<Set<WidgetId>>(() => new Set(initial));
  const count = picks.size;

  function toggle(id: WidgetId) {
    setPicks((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-lg [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl tracking-tight">
            What do you want on your dashboard?
          </DialogTitle>
          <DialogDescription>
            We recommend 4 or 5. Fewer cards means what matters is visible at a glance, with less
            scrolling and less to worry about.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2" aria-label="Dashboard widgets">
          {order.map((id) => {
            const on = picks.has(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    on
                      ? "border-primary/70 bg-primary/5"
                      : "border-foreground/15 hover:border-foreground/30",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{WIDGET_DETAILS[id].title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {WIDGET_DETAILS[id].detail}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30",
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          The CoursePro iPhone app uses the same dashboard unless you change that in the app's
          Settings.
        </p>

        <div className="space-y-2">
          <p className="text-center text-xs text-muted-foreground" aria-live="polite">
            {count === 0
              ? "Pick at least one."
              : count <= 5
                ? `${count} selected`
                : `${count} selected. That's a lot, and you can always change it with Customize widgets.`}
          </p>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => onSave(order.filter((id) => picks.has(id)))}
            className="glass-hover min-h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
