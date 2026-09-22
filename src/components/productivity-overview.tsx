import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { getAllAssignmentsFn } from "@/lib/canvas.functions";
import { completedAssignmentIds, completionRecords } from "@/lib/completion-records";
import { summarizeProductivity } from "@/lib/productivity";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { useAssignmentMeta } from "@/hooks/use-assignment-meta";

const dateLabel = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

export function ProductivityOverview() {
  const assignments = useQuery({ queryKey: ["canvas", "assignments"], queryFn: getAllAssignmentsFn, staleTime: 5 * 60_000 });
  const prefs = useUserPreferences();
  const meta = useAssignmentMeta();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const summary = useMemo(() => summarizeProductivity(
    assignments.data ?? [], completedAssignmentIds(prefs.data), completionRecords(prefs.data),
    new Map((meta.data ?? []).map((m) => [m.assignmentId, m.estimatedMinutes])), now,
  ), [assignments.data, prefs.data, meta.data, now]);
  const ready = assignments.data !== undefined && prefs.ready;
  const stats = [
    { label: "Completed · past 7 days", value: summary.completed },
    { label: "Overdue work cleared", value: summary.overdueCleared },
    { label: "Due · next 7 days", value: summary.upcoming },
    { label: "Busiest day next week", value: summary.busiest ? dateLabel(summary.busiest.date) : "Clear", detail: summary.busiest ? `${summary.busiest.count} due` : "No unfinished work due" },
  ];
  return (
    <section className="glass-panel p-5 sm:p-6" aria-labelledby="weekly-summary">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="weekly-summary" className="text-base font-semibold">Your week at a glance</h2>
        <Link to="/assignments" className="text-xs text-muted-foreground underline underline-offset-4">View assignments</Link>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{ready ? stat.value : "—"}</p>
            {ready && stat.detail && <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {assignments.isError || prefs.isError ? "Some data could not refresh. Try Sync above." :
          "Completion counts use Canvas submission dates and checkmarks recorded from now on. Next week runs Monday–Sunday."}
      </p>
      {ready && summary.warnings.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-foreground/10 pt-4">
          <p className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="h-4 w-4" /> Plan ahead</p>
          {summary.warnings.slice(0, 3).map((warning) => (
            <p key={warning.date} className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{dateLabel(warning.date)}: {warning.count} assignments due.</span>{" "}
              Consider starting “{warning.suggested.name}” {warning.start.toDateString() === now.toDateString() ? "today" : `by ${warning.start.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}.
            </p>
          ))}
          <p className="text-xs text-muted-foreground">Flags 3+ deadlines or 2+ major tasks on a day. Major tasks are inferred from titles or estimates of 90+ minutes.</p>
        </div>
      )}
    </section>
  );
}
