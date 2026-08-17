// Weekly class timetable derived live from the signed-in user's Canvas
// calendar events (no hardcoded data).
import { useQuery } from "@tanstack/react-query";
import { classScheduleQO } from "@/lib/canvas-queries";
import type { ClassScheduleSession } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";
import { useNicknames } from "@/lib/nicknames";
import { GlassCard, Skeleton, ErrorState } from "@/components/glass-card";

type Day = "M" | "T" | "W" | "R" | "F";

const DAY_ORDER: Day[] = ["M", "T", "W", "R", "F"];
const DAY_LABELS: Record<Day, string> = {
  M: "Monday",
  T: "Tuesday",
  W: "Wednesday",
  R: "Thursday",
  F: "Friday",
};

const PX_PER_MIN = 1.4;

function minutesToLabel(m: number): string {
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
}

function timeRange(s: ClassScheduleSession) {
  return `${minutesToLabel(s.startMinutes)} – ${minutesToLabel(s.endMinutes)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function CanvasClassSchedule() {
  useNicknames();
  const { data, isPending, isError, error, refetch } = useQuery(classScheduleQO);
  const sessions = data?.sessions ?? [];

  const byDay: Record<Day, ClassScheduleSession[]> = {
    M: [],
    T: [],
    W: [],
    R: [],
    F: [],
  };
  for (const s of sessions) {
    for (const d of s.days) {
      if ((DAY_ORDER as string[]).includes(d)) byDay[d as Day].push(s);
    }
  }
  for (const d of DAY_ORDER) byDay[d].sort((a, b) => a.startMinutes - b.startMinutes);

  const courseCount = new Set(sessions.map((s) => s.course_id)).size;
  const starts = sessions.map((s) => s.startMinutes);
  const ends = sessions.map((s) => s.endMinutes);
  const dayStart = starts.length > 0 ? Math.max(0, Math.min(...starts) - 60) : 8 * 60;
  const dayEnd = ends.length > 0 ? Math.min(24 * 60, Math.max(...ends) + 60) : 18 * 60;

  return (
    <div className="space-y-6">
      <header className="glass-panel-strong p-5 sm:p-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Live from Canvas
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Class Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recurring meeting times detected from your Canvas course calendars.
        </p>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <Stat label="Courses" value={String(courseCount)} />
          <Stat label="Weekly meetings" value={String(sessions.length)} />
          <Stat
            label="Updated"
            value={
              data?.generated_at
                ? new Date(data.generated_at).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—"
            }
          />
        </div>
      </header>

      {isPending ? (
        <GlassCard title="Weekly view">
          <Skeleton />
        </GlassCard>
      ) : isError ? (
        <div className="space-y-3">
          <ErrorState message={error instanceof Error ? error.message : "Couldn't load"} />
          <button
            type="button"
            onClick={() => void refetch()}
            className="glass-inset rounded-full px-4 py-2 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-panel p-6 text-sm text-muted-foreground">
          Canvas hasn't published any recurring class meeting times for your
          courses. Once your instructors add class meetings to the course
          calendar, they'll appear here automatically.
        </div>
      ) : (
        <>
          <section className="glass-panel p-4 md:p-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Weekly view
            </h2>
            <WeeklyGrid byDay={byDay} dayStart={dayStart} dayEnd={dayEnd} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Course details
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {sessions.map((s) => (
                <article key={s.key} className="glass-panel p-5">
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {displayCourseName(s.course_name, s.course_code)}
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-tight">
                    {s.title}
                  </h3>
                  <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <Row label="Days">
                      {s.days
                        .map((d) => DAY_LABELS[d as Day] ?? d)
                        .map((l) => l.slice(0, 3))
                        .join(" · ")}
                    </Row>
                    <Row label="Time">{timeRange(s)}</Row>
                    <Row label="Room">{s.location ?? "—"}</Row>
                    <Row label="Dates">
                      {formatDate(s.firstDate)} – {formatDate(s.lastDate)}
                    </Row>
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
  dayStart,
  dayEnd,
}: {
  byDay: Record<Day, ClassScheduleSession[]>;
  dayStart: number;
  dayEnd: number;
}) {
  const height = (dayEnd - dayStart) * PX_PER_MIN;
  const hourMarks: number[] = [];
  for (let h = Math.ceil(dayStart / 60) * 60; h <= dayEnd; h += 60) hourMarks.push(h);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px] gap-2">
        <div className="relative w-14 shrink-0 pr-2" style={{ height: `${height}px` }}>
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute right-2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              style={{ top: `${(m - dayStart) * PX_PER_MIN}px` }}
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
            <div className="glass-inset relative rounded-xl" style={{ height: `${height}px` }}>
              {hourMarks.slice(1, -1).map((m) => (
                <div
                  key={m}
                  className="absolute inset-x-0 border-t border-white/5"
                  style={{ top: `${(m - dayStart) * PX_PER_MIN}px` }}
                />
              ))}
              {byDay[d].map((s) => (
                <div
                  key={`${d}-${s.key}`}
                  className="glass-panel absolute inset-x-1 overflow-hidden rounded-lg p-2"
                  style={{
                    top: `${(s.startMinutes - dayStart) * PX_PER_MIN}px`,
                    height: `${(s.endMinutes - s.startMinutes) * PX_PER_MIN}px`,
                  }}
                >
                  <p className="truncate text-xs font-semibold tracking-tight">
                    {displayCourseName(s.course_name, s.course_code)}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {timeRange(s)}
                  </p>
                  {s.location ? (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {s.location}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
