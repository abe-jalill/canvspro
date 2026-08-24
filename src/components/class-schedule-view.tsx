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
  const groups = groupByTitle(sessions);
  const credits = totalCredits(groups.map((g) => g.sessions[0]));


  return (
    <div className="space-y-6">
      <header className="glass-panel-strong p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
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
          <Stat label="Classes" value={String(groups.length)} />
          {credits > 0 ? (
            <Stat label="Credit Hours" value={String(credits)} />
          ) : null}
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
          Your classes
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const c = g.sessions[0];
            const varied = g.sessions.length > 1;
            return (
              <article key={g.key} className="glass-panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-base font-semibold tracking-tight">
                    {c.title}
                  </h3>
                  {c.credits > 0 ? (
                    <span className="glass-inset shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {c.credits} cr
                    </span>
                  ) : null}
                </div>
                <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  {varied ? (
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Meeting times
                      </dt>
                      <dd className="mt-1 space-y-0.5 text-sm text-foreground">
                        {g.sessions.map((s) => (
                          <p key={s.id}>
                            {s.days.map((d) => DAY_LABELS[d].slice(0, 3)).join(" ")}
                            {" · "}
                            {s.timeLabel}
                          </p>
                        ))}
                      </dd>
                    </div>
                  ) : (
                    <>
                      <Row label="Days">
                        {c.days.map((d) => DAY_LABELS[d].slice(0, 3)).join(" ") ||
                          "—"}
                      </Row>
                      <Row label="Time">{c.timeLabel}</Row>
                    </>
                  )}
                  {c.instructor ? (
                    <Row label="Professor">{c.instructor}</Row>
                  ) : null}
                  {c.location ? <Row label="Location">{c.location}</Row> : null}
                </dl>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

/** Rows for one class name are grouped so per-day times show in one card. */
function groupByTitle(
  sessions: ClassSession[],
): { key: string; sessions: ClassSession[] }[] {
  const map = new Map<string, ClassSession[]>();
  for (const s of sessions) {
    const k = s.title.trim().toLowerCase();
    const list = map.get(k);
    if (list) list.push(s);
    else map.set(k, [s]);
  }
  return [...map.entries()].map(([key, list]) => ({ key, sessions: list }));
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
  // Bounds derived from the actual classes so blocks never sit outside the grid.
  const all = DAY_ORDER.flatMap((d) => byDay[d]);
  const earliest = all.length
    ? Math.min(...all.map((s) => s.startMinutes))
    : DAY_START;
  const latest = all.length ? Math.max(...all.map((s) => s.endMinutes)) : DAY_END;
  const start = Math.min(DAY_START, Math.floor(earliest / 60) * 60);
  const end = Math.max(DAY_END, Math.ceil(latest / 60) * 60);

  const height = (end - start) * PX_PER_MIN;
  const hourMarks: number[] = [];
  for (let h = start; h <= end; h += 60) hourMarks.push(h);

  return (
    <div className="no-scrollbar overflow-x-auto overflow-y-hidden">
      <div className="min-w-[640px]">
        {/* Header row: spacer keeps the time gutter aligned with the grid body */}
        <div className="flex gap-2">
          <div className="w-14 shrink-0" />
          {DAY_ORDER.map((d) => (
            <div
              key={d}
              className="flex-1 pb-2 text-center text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
            >
              <span className="hidden sm:inline">{DAY_LABELS[d]}</span>
              <span className="sm:hidden">{DAY_LABELS[d].slice(0, 3)}</span>
            </div>
          ))}
        </div>

        <div className="flex gap-2" style={{ height: `${height}px` }}>
          {/* Time gutter */}
          <div className="relative w-14 shrink-0 pr-2">
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
            <div key={d} className="glass-inset relative flex-1 rounded-xl">
              {hourMarks.slice(1, -1).map((m) => (
                <div
                  key={m}
                  className="absolute left-0 right-0 border-t border-foreground/[0.06]"
                  style={{ top: `${(m - start) * PX_PER_MIN}px` }}
                />
              ))}
              {byDay[d].map((s) => {
                const top = (s.startMinutes - start) * PX_PER_MIN;
                const h =
                  Math.max(28, (s.endMinutes - s.startMinutes) * PX_PER_MIN) - 4;
                return (
                  <div
                    key={`${s.id}-${d}`}
                    className="glass-panel absolute left-1 right-1 overflow-hidden rounded-lg p-2 text-[11px] leading-tight"
                    style={{ top: `${top}px`, height: `${h}px` }}
                    title={`${s.title} · ${s.location}`}
                  >
                    <p className="truncate font-semibold tracking-tight">
                      {s.displayName}
                    </p>
                    <p className="truncate text-muted-foreground">{s.timeLabel}</p>
                    <p className="truncate text-muted-foreground/80">
                      {s.location}
                    </p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

