import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Info,
  ShieldCheck,
} from "lucide-react";
import { getAllAssignmentsFn } from "@/lib/canvas.functions";
import { completedAssignmentIds, completionRecords } from "@/lib/completion-records";
import { summarizeProductivity } from "@/lib/productivity";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useAssignmentMeta } from "@/hooks/use-assignment-meta";
import { cn } from "@/lib/utils";

const dateLabel = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

interface Metric {
  label: string;
  value: string | number;
  detail: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  accent: string;
}

export function ProductivityOverview() {
  const assignments = useQuery({
    queryKey: ["canvas", "assignments"],
    queryFn: getAllAssignmentsFn,
    staleTime: 5 * 60_000,
  });
  const prefs = useUserPreferences();
  const meta = useAssignmentMeta();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(
    () =>
      summarizeProductivity(
        assignments.data ?? [],
        completedAssignmentIds(prefs.data),
        completionRecords(prefs.data),
        new Map((meta.data ?? []).map((item) => [item.assignmentId, item.estimatedMinutes])),
        now,
      ),
    [assignments.data, prefs.data, meta.data, now],
  );
  const ready = assignments.data !== undefined && prefs.ready;
  const metrics: Metric[] = [
    {
      label: "Completed",
      value: summary.completed,
      detail: "in the past 7 days",
      icon: CheckCircle2,
      accent: "text-emerald-400 bg-emerald-400/10",
    },
    {
      label: "Caught up",
      value: summary.overdueCleared,
      detail: "overdue items cleared",
      icon: ShieldCheck,
      accent: "text-sky-400 bg-sky-400/10",
    },
    {
      label: "Coming up",
      value: summary.upcoming,
      detail: "due in the next 7 days",
      icon: CalendarDays,
      accent: "text-violet-400 bg-violet-400/10",
    },
    {
      label: "Busiest day",
      value: summary.busiest ? dateLabel(summary.busiest.date) : "Clear",
      detail: summary.busiest
        ? `${summary.busiest.count} due next week`
        : "nothing unfinished next week",
      icon: CalendarClock,
      accent: "text-amber-400 bg-amber-400/10",
    },
  ];

  return (
    <section
      className="relative overflow-hidden rounded-[2rem] border border-foreground/10 bg-foreground/[0.025] p-4 shadow-glass sm:p-6"
      aria-labelledby="weekly-summary"
      aria-busy={!ready}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Weekly pulse
          </p>
          <h2
            id="weekly-summary"
            className="mt-1.5 text-xl font-medium tracking-[-0.03em] text-foreground sm:text-2xl"
          >
            Momentum, at a glance.
          </h2>
        </div>
        <Link
          to="/assignments"
          className="press group inline-flex min-h-10 w-fit items-center gap-2 rounded-full border border-foreground/10 bg-foreground/[0.04] px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
        >
          View assignments
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="group flex min-h-36 flex-col justify-between rounded-[1.35rem] border border-foreground/[0.08] bg-background/25 p-4 transition-colors hover:bg-foreground/[0.04] sm:p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {metric.label}
                </p>
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl",
                    metric.accent,
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden={true} />
                </span>
              </div>
              <div>
                {ready ? (
                  <p
                    className={cn(
                      "font-medium tracking-[-0.045em] text-foreground",
                      index === 3 ? "text-2xl" : "text-4xl tabular-nums",
                    )}
                  >
                    {metric.value}
                  </p>
                ) : (
                  <div className="skeleton-shimmer h-10 w-16" />
                )}
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{metric.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {ready && summary.warnings.length > 0 && (
        <div className="mt-3 rounded-[1.35rem] border border-amber-400/15 bg-amber-400/[0.045] p-4 sm:p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarClock className="h-4 w-4 text-amber-400" aria-hidden="true" />
            Plan ahead
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {summary.warnings.slice(0, 3).map((warning) => (
              <p
                key={warning.date}
                className="rounded-xl border border-foreground/[0.07] bg-background/20 p-3 text-xs leading-relaxed text-muted-foreground"
              >
                <span className="font-medium text-foreground">
                  {dateLabel(warning.date)} · {warning.count} due
                </span>
                <br />
                Start “{warning.suggested.name}”{" "}
                {warning.start.toDateString() === now.toDateString()
                  ? "today"
                  : `by ${warning.start.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}`}
                .
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 border-t border-foreground/[0.07] pt-4 text-[11px] leading-relaxed text-muted-foreground/80">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>
          {assignments.isError || prefs.isError
            ? "Some data could not refresh. Use Sync above to try again."
            : "Based on Canvas submission dates and your CanvasPro checkmarks. Next week runs Monday–Sunday."}
        </p>
      </div>
    </section>
  );
}
