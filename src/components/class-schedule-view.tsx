// Renders a user's weekly class timetable in the original grid + detail format.
import {
  DAY_LABELS,
  DAY_ORDER,
  minutesToLabel,
  sessionsByDay,
  totalCredits,
  type ClassDay,
  type ClassSession,
} from "@/lib/class-schedule";

// Weekly grid bounds
const DAY_START = 8 * 60; // 8:00
const DAY_END = 18 * 60; // 6:00 PM
const PX_PER_MIN = 1.4; // grid density

export default function ClassScheduleView({
  sessions,
  onEdit,
}: {
  sessions: ClassSession[];
  onEdit?: () => void;
}) {
  const byDay = sessionsByDay(sessions);
  const term = sessions.find((s) => s.term)?.term ?? "My semester";
  const dates = sessions.find((s) => s.dateRange)?.dateRange ?? "—";
  const campus = sessions.find((s) => s.campus)?.campus ?? "—";

  return (
    <div className="space-y-6">
      <header className="glass-panel-strong p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {term}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Class Schedule
            </h1>
          </div>
          {onEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="glass-inset press rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
            >
              Edit schedule
            </button>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <Stat label="Courses" value={String(sessions.length)} />
          <Stat label="Credit Hours" value={totalCredits(sessions).toFixed(3)} />
          <Stat label="Dates" value={dates} />
          <Stat label="Campus" value={campus} />
        </div>
      </header>

      <section className="glass-panel p-4 md:p-6">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Weekly view
        </h2>
        <WeeklyGrid byDay={byDay} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Course details
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {sessions.map((c) => (
            <article key={c.id} className="glass-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {c.code || c.section || c.crn ? (
                    <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      {[c.code, c.section, c.crn ? `CRN ${c.crn}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                  <h3 className="mt-1 text-base font-semibold tracking-tight">
                    {c.title}
                  </h3>
                </div>
                <span className="glass-inset shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {c.credits} cr
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <Row label="Days">
                  {c.days.map((d) => DAY_LABELS[d].slice(0, 3)).join(" ") || "—"}
                </Row>
                <Row label="Time">{c.timeLabel}</Row>
                <Row label="Room">{c.location || "—"}</Row>
                <Row label="Type">{c.scheduleType}</Row>
                <Row label="Instructor">{c.instructor || "—"}</Row>
                <Row label="Dates">{c.dateRange || "—"}</Row>
              </dl>
            </article>
          ))}
        </div>
      </section>
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

function WeeklyGrid({ byDay }: { byDay: Record<ClassDay, ClassSession[]> }) {
  const totalMin = DAY_END - DAY_START;
  const height = totalMin * PX_PER_MIN;
  const hourMarks: number[] = [];
  for (let h = DAY_START; h <= DAY_END; h += 60) hourMarks.push(h);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[720px] gap-2">
        {/* Time gutter */}
        <div
          className="relative w-14 shrink-0 pr-2"
          style={{ height: `${height}px` }}
        >
          {hourMarks.map((m) => (
            <div
              key={m}
              className="absolute right-2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground"
              style={{ top: `${(m - DAY_START) * PX_PER_MIN}px` }}
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
                  style={{ top: `${(m - DAY_START) * PX_PER_MIN}px` }}
                />
              ))}
              {byDay[d].map((s) => {
                const top = Math.max(0, (s.startMinutes - DAY_START) * PX_PER_MIN);
                const h =
                  Math.max(24, (s.endMinutes - s.startMinutes) * PX_PER_MIN) - 4;
                return (
                  <div
                    key={`${s.id}-${d}`}
                    className="glass-panel absolute left-1 right-1 overflow-hidden rounded-lg p-2 text-[11px] leading-tight"
                    style={{ top: `${top}px`, height: `${h}px` }}
                    title={`${s.title} · ${s.location}`}
                  >
                    <p className="font-semibold tracking-tight">
                      {s.displayName}
                    </p>
                    <p className="text-muted-foreground">{s.timeLabel}</p>
                    <p className="text-muted-foreground/80 truncate">
                      {s.location}
                    </p>
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
