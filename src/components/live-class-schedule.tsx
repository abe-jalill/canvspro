// Weekly timetable built from the signed-in user's own Canvas calendar.
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getClassMeetingsFn } from "@/lib/canvas.functions";
import { Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import {
  DAY_LABELS,
  DAY_ORDER,
  deriveWeeklySchedule,
  minutesToLabel,
  scheduleBounds,
  sessionsByDay,
  type ClassDay,
  type DerivedSession,
} from "@/lib/derive-class-schedule";

const meetingsQO = queryOptions({
  queryKey: ["canvas", "class-meetings"],
  queryFn: () => getClassMeetingsFn(),
  staleTime: 30 * 60_000,
});

const PX_PER_MIN = 1.4;

export default function LiveClassSchedule() {
  const meetings = useQuery(meetingsQO);
  const sessions = deriveWeeklySchedule(meetings.data ?? []);
  const byDay = sessionsByDay(sessions);
  const bounds = scheduleBounds(sessions);

  return (
    <div className="space-y-6">
      <header className="glass-panel-strong p-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          From your Canvas calendar
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Class Schedule
        </h1>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <Stat label="Meetings" value={String(sessions.length)} />
          <Stat
            label="Days"
            value={String(DAY_ORDER.filter((d) => byDay[d].length > 0).length)}
          />
          <Stat
            label="Weekly hours"
            value={weeklyHours(sessions).toFixed(1)}
          />
        </div>
      </header>

      {meetings.isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-64" />
        </div>
      )}
      {meetings.error && (
        <ErrorState message={(meetings.error as Error).message} />
      )}

      {!meetings.isLoading && !meetings.error && sessions.length === 0 && (
        <div className="glass-panel p-6">
          <EmptyState message="No recurring class meetings found in your Canvas calendar. Your school may not publish class times to Canvas." />
        </div>
      )}

      {sessions.length > 0 && (
        <>
          <section className="glass-panel p-4 md:p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Weekly view
            </h2>
            <WeeklyGrid byDay={byDay} start={bounds.start} end={bounds.end} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Meeting details
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {sessions.map((s) => (
                <article key={s.id} className="glass-panel p-5">
                  {s.context && (
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {s.context}
                    </p>
                  )}
                  <h3 className="mt-1 text-base font-semibold tracking-tight">
                    {s.title}
                  </h3>
                  <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <Row label="Days">
                      {s.days.map((d) => DAY_LABELS[d].slice(0, 3)).join(" · ")}
                    </Row>
                    <Row label="Time">{s.timeLabel}</Row>
                    {s.location && <Row label="Location">{s.location}</Row>}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function weeklyHours(sessions: DerivedSession[]) {
  return sessions.reduce(
    (sum, s) => sum + (s.days.length * (s.endMinutes - s.startMinutes)) / 60,
    0,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function WeeklyGrid({
  byDay,
  start,
  end,
}: {
  byDay: Record<ClassDay, DerivedSession[]>;
  start: number;
  end: number;
}) {
  const height = (end - start) * PX_PER_MIN;
  const hourMarks: number[] = [];
  for (let h = start; h <= end; h += 60) hourMarks.push(h);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px] gap-2">
        <div
          className="relative w-14 shrink-0 pr-2"
          style={{ height: `${height}px` }}
        >
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute right-2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              style={{ top: `${(m - start) * PX_PER_MIN}px` }}
            >
              {minutesToLabel(m)}
            </div>
          ))}
        </div>

        {DAY_ORDER.map((d) => (
          <div key={d} className="flex-1">
            <div className="mb-2 text-center text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {DAY_LABELS[d]}
            </div>
            <div
              className="glass-inset relative rounded-xl"
              style={{ height: `${height}px` }}
            >
              {hourMarks.slice(1, -1).map((m) => (
                <div
                  key={m}
                  className="absolute left-0 right-0 border-t border-foreground/[0.06]"
                  style={{ top: `${(m - start) * PX_PER_MIN}px` }}
                />
              ))}
              {byDay[d].map((s) => {
                const top = Math.max(0, (s.startMinutes - start) * PX_PER_MIN);
                const h =
                  Math.max(24, (s.endMinutes - s.startMinutes) * PX_PER_MIN) - 4;
                return (
                  <div
                    key={`${s.id}-${d}`}
                    className="glass-panel absolute left-1 right-1 overflow-hidden rounded-lg p-2 text-[11px] leading-tight"
                    style={{ top: `${top}px`, height: `${h}px` }}
                    title={`${s.title}${s.location ? ` · ${s.location}` : ""}`}
                  >
                    <p className="font-semibold tracking-tight">
                      {s.displayName}
                    </p>
                    <p className="text-muted-foreground">{s.timeLabel}</p>
                    {s.location && (
                      <p className="truncate text-muted-foreground/80">
                        {s.location}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
