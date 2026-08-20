// Elevated "briefing" card that opens the Dashboard: greeting, next class
// countdown, and a one-line workload summary.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CalendarClock, ArrowRight } from "lucide-react";
import { assignmentsQO, classMeetingsQO } from "@/lib/canvas-queries";
import {
  DAY_LABELS,
  deriveWeeklySchedule,
  minutesToLabel,
  type ClassDay,
  type DerivedSession,
} from "@/lib/derive-class-schedule";
import { manualToSessions, useManualClasses } from "@/lib/manual-class-schedule";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const DAY_INDEX: Record<ClassDay, number> = { M: 1, T: 2, W: 3, R: 4, F: 5 };

/** Next upcoming weekly meeting relative to `now`, searching a 7-day window. */
function nextMeeting(sessions: DerivedSession[], now: Date) {
  let best: { session: DerivedSession; at: Date; day: ClassDay } | null = null;
  for (const s of sessions) {
    for (const day of s.days) {
      const target = DAY_INDEX[day];
      let delta = (target - now.getDay() + 7) % 7;
      const at = new Date(now);
      at.setDate(now.getDate() + delta);
      at.setHours(Math.floor(s.startMinutes / 60), s.startMinutes % 60, 0, 0);
      if (at.getTime() <= now.getTime()) {
        at.setDate(at.getDate() + 7);
      }
      if (!best || at.getTime() < best.at.getTime()) best = { session: s, at, day };
    }
  }
  return best;
}

function countdownLabel(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `in ${h}h ${m}m` : `in ${h}h`;
  const d = Math.round(h / 24);
  return `in ${d} day${d === 1 ? "" : "s"}`;
}

export function DashboardSummary() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const meetings = useQuery(classMeetingsQO);
  const assignments = useQuery(assignmentsQO);
  const manual = useManualClasses();
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const sessions = [
    ...deriveWeeklySchedule(meetings.data ?? []),
    ...manualToSessions(manual.entries),
  ];
  const next = nextMeeting(sessions, now);

  const open = (assignments.data ?? []).filter(
    (a) =>
      a.due_at &&
      !completed.has(a.id) &&
      !a.submission?.submitted_at &&
      new Date(a.due_at).getTime() > now.getTime(),
  );
  const weekMs = now.getTime() + 7 * 86_400_000;
  const dayMs = now.getTime() + 86_400_000;
  const dueWeek = open.filter((a) => new Date(a.due_at!).getTime() <= weekMs).length;
  const dueTomorrow = open.filter((a) => new Date(a.due_at!).getTime() <= dayMs).length;

  const summary =
    dueWeek === 0
      ? "Nothing due in the next 7 days — enjoy the breathing room."
      : `${dueWeek} assignment${dueWeek === 1 ? "" : "s"} due this week${
          dueTomorrow > 0 ? `, ${dueTomorrow} within 24 hours` : ""
        }.`;

  return (
    <section
      aria-label="Dashboard summary"
      className="glass-panel-strong relative min-w-0 overflow-hidden p-5 sm:p-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-foreground/[0.07] blur-3xl"
      />
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Dashboard summary
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
        {greeting(now)}
      </h2>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="glass-inset min-w-0 p-4">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Next class
          </p>
          {next ? (
            <>
              <p className="mt-2 truncate text-sm font-semibold">
                {next.session.displayName || next.session.title}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {DAY_LABELS[next.day]} · {minutesToLabel(next.session.startMinutes)} ·{" "}
                <span className="font-medium text-foreground">
                  {countdownLabel(next.at.getTime() - now.getTime())}
                </span>
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              No class times yet —{" "}
              <Link to="/class-schedule" className="underline underline-offset-4">
                add your schedule
              </Link>
              .
            </p>
          )}
        </div>

        <div className="glass-inset min-w-0 p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            This week
          </p>
          <p className="mt-2 text-sm font-medium">{summary}</p>
          <Link
            to="/focus"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Open Focus <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </section>
  );
}
