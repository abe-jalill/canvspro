// Minimal entry form for a user's recurring class meeting times. Canvas's API
// does not expose section meeting times reliably, so they're entered here and
// stored per-account. Only class name, days and times are required.
// A class can optionally use different times for each meeting day; in that case
// one row is stored per day, and the view groups them back by class name.
import { useEffect, useState } from "react";
import {
  DAY_LABELS,
  DAY_ORDER,
  parseTimeInput,
  toTimeInput,
  type ClassDay,
  type ClassSession,
} from "@/lib/class-schedule";
import {
  useSaveClassSchedule,
  type ScheduleEntryInput,
} from "@/lib/user-class-schedule";

type DayTimes = Partial<Record<ClassDay, { start: string; end: string }>>;

interface Draft {
  key: string;
  title: string;
  credits: string;
  instructor: string;
  location: string;
  days: ClassDay[];
  start: string;
  end: string;
  perDay: boolean;
  dayTimes: DayTimes;
}

let keySeq = 0;
const nextKey = () => `row-${keySeq++}`;

function emptyDraft(): Draft {
  return {
    key: nextKey(),
    title: "",
    credits: "",
    instructor: "",
    location: "",
    days: [],
    start: "09:30",
    end: "10:45",
    perDay: false,
    dayTimes: {},
  };
}

/** Groups stored rows back into one draft per class name. */
function toDrafts(sessions: ClassSession[]): Draft[] {
  const groups = new Map<string, ClassSession[]>();
  for (const s of sessions) {
    const k = s.title.trim().toLowerCase();
    const list = groups.get(k);
    if (list) list.push(s);
    else groups.set(k, [s]);
  }

  return [...groups.values()].map((list) => {
    const first = list[0];
    const days: ClassDay[] = [];
    const dayTimes: DayTimes = {};
    for (const s of list) {
      for (const d of s.days) {
        if (!days.includes(d)) days.push(d);
        dayTimes[d] = {
          start: toTimeInput(s.startMinutes),
          end: toTimeInput(s.endMinutes),
        };
      }
    }
    const ordered = DAY_ORDER.filter((d) => days.includes(d));
    const distinct = new Set(
      ordered.map((d) => `${dayTimes[d]?.start}-${dayTimes[d]?.end}`),
    );
    return {
      key: nextKey(),
      title: first.title,
      credits: first.credits ? String(first.credits) : "",
      instructor: first.instructor,
      location: first.location,
      days: ordered,
      start: toTimeInput(first.startMinutes),
      end: toTimeInput(first.endMinutes),
      perDay: distinct.size > 1,
      dayTimes,
    };
  });
}

export default function ClassScheduleEditor({
  sessions,
  onSaved,
  onCancel,
}: {
  sessions: ClassSession[];
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const save = useSaveClassSchedule();
  const [rows, setRows] = useState<Draft[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setRows(sessions.length > 0 ? toDrafts(sessions) : [emptyDraft()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length]);

  function update(key: string, patch: Partial<Draft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function setDayTime(
    key: string,
    day: ClassDay,
    patch: { start?: string; end?: string },
  ) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              dayTimes: {
                ...r.dayTimes,
                [day]: {
                  start: patch.start ?? r.dayTimes[day]?.start ?? r.start,
                  end: patch.end ?? r.dayTimes[day]?.end ?? r.end,
                },
              },
            }
          : r,
      ),
    );
  }

  function togglePerDay(key: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        if (r.perDay) return { ...r, perDay: false };
        const dayTimes: DayTimes = { ...r.dayTimes };
        for (const d of r.days) {
          if (!dayTimes[d]) dayTimes[d] = { start: r.start, end: r.end };
        }
        return { ...r, perDay: true, dayTimes };
      }),
    );
  }

  function toggleDay(key: string, day: ClassDay) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const days = r.days.includes(day)
          ? r.days.filter((d) => d !== day)
          : [...DAY_ORDER].filter((d) => d === day || r.days.includes(d));
        const dayTimes: DayTimes = { ...r.dayTimes };
        if (!r.days.includes(day) && !dayTimes[day]) {
          dayTimes[day] = { start: r.start, end: r.end };
        }
        return { ...r, days, dayTimes };
      }),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);

    const filled = rows.filter((r) => r.title.trim().length > 0);
    if (filled.length === 0) {
      setStatus("Add at least one class with a name.");
      return;
    }
    const payload: ScheduleEntryInput[] = [];
    for (const r of filled) {
      if (r.days.length === 0) {
        setStatus(`Pick at least one meeting day for "${r.title.trim()}".`);
        return;
      }

      const base = {
        code: "",
        section: "",
        title: r.title,
        crn: "",
        credits: Number(r.credits) || 0,
        instructor: r.instructor,
        location: r.location,
        campus: "",
        scheduleType: "Lecture",
        term: "",
        dateRange: "",
      };

      if (!r.perDay) {
        const start = parseTimeInput(r.start);
        const end = parseTimeInput(r.end);
        if (start === null || end === null || end <= start) {
          setStatus(`Check the start and end time for "${r.title.trim()}".`);
          return;
        }
        payload.push({
          ...base,
          days: r.days,
          startMinutes: start,
          endMinutes: end,
        });
        continue;
      }

      for (const d of DAY_ORDER.filter((x) => r.days.includes(x))) {
        const t = r.dayTimes[d] ?? { start: r.start, end: r.end };
        const start = parseTimeInput(t.start);
        const end = parseTimeInput(t.end);
        if (start === null || end === null || end <= start) {
          setStatus(
            `Check the ${DAY_LABELS[d]} time for "${r.title.trim()}".`,
          );
          return;
        }
        payload.push({
          ...base,
          days: [d],
          startMinutes: start,
          endMinutes: end,
        });
      }
    }

    try {
      await save.mutateAsync(payload);
      setStatus("Schedule saved.");
      onSaved?.();
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Could not save your schedule.",
      );
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <header className="glass-panel-strong p-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Enter your class schedule
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Add each class once — name, meeting days, and times. Credit hours,
          professor, and location are optional. If a class meets at different
          times on different days, turn on “Different times each day”.
        </p>
      </header>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="glass-panel space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Class {i + 1}
              </p>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setRows((prev) => prev.filter((x) => x.key !== r.key))
                  }
                  className="glass-inset press rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Class name">
                <input
                  value={r.title}
                  onChange={(e) => update(r.key, { title: e.target.value })}
                  placeholder="Calculus 2"
                  maxLength={100}
                  className="field"
                />
              </Field>
              <Field label="Credit hours (optional)">
                <input
                  type="number"
                  min={0}
                  max={12}
                  step="0.5"
                  value={r.credits}
                  onChange={(e) => update(r.key, { credits: e.target.value })}
                  placeholder="3"
                  className="field"
                />
              </Field>
              <Field label="Professor">
                <input
                  value={r.instructor}
                  onChange={(e) => update(r.key, { instructor: e.target.value })}
                  placeholder="Prof. name"
                  maxLength={100}
                  className="field"
                />
              </Field>
              <Field label="Location (optional)">
                <input
                  value={r.location}
                  onChange={(e) => update(r.key, { location: e.target.value })}
                  placeholder="Room S206"
                  maxLength={100}
                  className="field"
                />
              </Field>
              {!r.perDay ? (
                <>
                  <Field label="Start time">
                    <input
                      type="time"
                      value={r.start}
                      onChange={(e) => update(r.key, { start: e.target.value })}
                      className="field"
                    />
                  </Field>
                  <Field label="End time">
                    <input
                      type="time"
                      value={r.end}
                      onChange={(e) => update(r.key, { end: e.target.value })}
                      className="field"
                    />
                  </Field>
                </>
              ) : null}
            </div>

            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Meeting days
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {DAY_ORDER.map((d) => {
                  const on = r.days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(r.key, d)}
                      aria-pressed={on}
                      className={`press min-h-11 rounded-full px-4 text-xs font-medium uppercase tracking-wider ${
                        on
                          ? "glass-panel-strong text-foreground"
                          : "glass-inset text-muted-foreground"
                      }`}
                    >
                      {DAY_LABELS[d].slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => togglePerDay(r.key)}
              aria-pressed={r.perDay}
              className={`press min-h-11 rounded-full px-4 text-[11px] font-medium uppercase tracking-[0.14em] ${
                r.perDay
                  ? "glass-panel-strong text-foreground"
                  : "glass-inset text-muted-foreground"
              }`}
            >
              {r.perDay
                ? "Using different times each day"
                : "Different times each day"}
            </button>

            {r.perDay ? (
              r.days.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Pick meeting days above to set their times.
                </p>
              ) : (
                <div className="space-y-2">
                  {DAY_ORDER.filter((d) => r.days.includes(d)).map((d) => {
                    const t = r.dayTimes[d] ?? { start: r.start, end: r.end };
                    return (
                      <div
                        key={d}
                        className="glass-inset flex flex-wrap items-center gap-2 rounded-xl p-3"
                      >
                        <span className="w-20 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {DAY_LABELS[d]}
                        </span>
                        <input
                          type="time"
                          value={t.start}
                          onChange={(e) =>
                            setDayTime(r.key, d, { start: e.target.value })
                          }
                          aria-label={`${DAY_LABELS[d]} start time`}
                          className="field w-auto flex-1 min-w-[7rem]"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={t.end}
                          onChange={(e) =>
                            setDayTime(r.key, d, { end: e.target.value })
                          }
                          aria-label={`${DAY_LABELS[d]} end time`}
                          className="field w-auto flex-1 min-w-[7rem]"
                        />
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, emptyDraft()])}
          className="glass-inset press min-h-11 rounded-full px-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
        >
          Add another class
        </button>
        <button
          type="submit"
          disabled={save.isPending}
          className="glass-panel-strong press min-h-11 rounded-full px-6 text-xs font-medium uppercase tracking-[0.14em] disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save schedule"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 px-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {status ? (
        <p className="text-sm text-muted-foreground" role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
