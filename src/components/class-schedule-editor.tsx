// Minimal entry form for a user's recurring class meeting times. Canvas's API
// does not expose section meeting times reliably, so they're entered here and
// stored per-account. Only days and times are required — class names come from
// Canvas when a key is connected, otherwise they're typed in.
// A class can optionally use different times for each meeting day; in that case
// one row is stored per day, and the view groups them back by class name.
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DAY_LABELS,
  DAY_ORDER,
  conflictLabel,
  findScheduleConflicts,
  parseTimeInput,
  toTimeInput,
  type ClassDay,
  type ClassSession,
  type ConflictItem,
} from "@/lib/class-schedule";
import { useSaveClassSchedule, type ScheduleEntryInput } from "@/lib/user-class-schedule";
import { getCoursesFn } from "@/lib/canvas.functions";
import { useCanvasKey } from "@/lib/user-settings";
import { displayCourseName } from "@/lib/course-display";

type DayTimes = Partial<Record<ClassDay, { start: string; end: string }>>;

interface Draft {
  key: string;
  title: string;
  fromCanvas: boolean;
  credits: string;
  instructor: string;
  location: string;
  days: ClassDay[];
  start: string;
  end: string;
  perDay: boolean;
  details: boolean;
  dayTimes: DayTimes;
}

let keySeq = 0;
const nextKey = () => `row-${keySeq++}`;

function emptyDraft(title = "", fromCanvas = false): Draft {
  return {
    key: nextKey(),
    title,
    fromCanvas,
    credits: "",
    instructor: "",
    location: "",
    days: [],
    start: "09:30",
    end: "10:45",
    perDay: false,
    details: false,
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
    const distinct = new Set(ordered.map((d) => `${dayTimes[d]?.start}-${dayTimes[d]?.end}`));
    return {
      key: nextKey(),
      title: first.title,
      fromCanvas: false,
      credits: first.credits ? String(first.credits) : "",
      instructor: first.instructor,
      location: first.location,
      days: ordered,
      start: toTimeInput(first.startMinutes),
      end: toTimeInput(first.endMinutes),
      perDay: distinct.size > 1,
      details: Boolean(first.credits || first.instructor.trim() || first.location.trim()),
      dayTimes,
    };
  });
}

/** Expands drafts into per-day meetings so overlaps can be detected. */
function toConflictItems(rows: Draft[]): ConflictItem[] {
  const items: ConflictItem[] = [];
  for (const r of rows) {
    for (const d of r.days) {
      const t = r.perDay
        ? (r.dayTimes[d] ?? { start: r.start, end: r.end })
        : { start: r.start, end: r.end };
      const start = parseTimeInput(t.start);
      const end = parseTimeInput(t.end);
      if (start === null || end === null || end <= start) continue;
      items.push({
        key: r.key,
        title: r.title.trim(),
        days: [d],
        startMinutes: start,
        endMinutes: end,
      });
    }
  }
  return items;
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
  const firstTime = sessions.length === 0;
  const { data: hasKey } = useCanvasKey();
  const { data: courses } = useQuery({
    queryKey: ["canvas", "courses"] as const,
    queryFn: getCoursesFn,
    enabled: Boolean(hasKey),
    staleTime: 5 * 60_000,
  });
  const [rows, setRows] = useState<Draft[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const canvasTitles = useMemo(
    () =>
      (courses ?? [])
        .map((c) => displayCourseName(c.name, c.course_code).trim())
        .filter((t) => t.length > 0),
    [courses],
  );

  useEffect(() => {
    if (!firstTime) {
      setRows(toDrafts(sessions));
      return;
    }
    setRows(
      canvasTitles.length > 0 ? canvasTitles.map((t) => emptyDraft(t, true)) : [emptyDraft()],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstTime, sessions.length, canvasTitles.join("|")]);

  const conflicts = useMemo(() => findScheduleConflicts(toConflictItems(rows)), [rows]);
  const conflictKeys = useMemo(() => {
    const s = new Set<string>();
    for (const c of conflicts) {
      s.add(c.a.key);
      s.add(c.b.key);
    }
    return s;
  }, [conflicts]);

  function update(key: string, patch: Partial<Draft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function setDayTime(key: string, day: ClassDay, patch: { start?: string; end?: string }) {
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

    const filled = rows.filter((r) => r.title.trim().length > 0 && r.days.length > 0);
    if (filled.length === 0) {
      setStatus("Add at least one class with a name, days and times.");
      return;
    }
    const payload: ScheduleEntryInput[] = [];
    for (const r of filled) {
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
          setStatus(`Check the ${DAY_LABELS[d]} time for "${r.title.trim()}".`);
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
      setStatus(err instanceof Error ? err.message : "Could not save your schedule.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <header className="glass-panel-strong p-4 sm:p-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {firstTime ? "Add your class times" : "Edit your class schedule"}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {firstTime && canvasTitles.length > 0
            ? "Your classes came from Canvas — just pick the days and times each one meets. Everything else is optional."
            : "Pick the meeting days and times for each class. Everything else is optional."}
        </p>
      </header>

      {conflicts.length > 0 ? (
        <div
          role="status"
          className="glass-inset rounded-2xl px-4 py-3 text-xs text-muted-foreground"
        >
          <p className="font-medium uppercase tracking-[0.14em]">
            {conflicts.length === 1 ? "1 time conflict" : `${conflicts.length} time conflicts`}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {conflicts.slice(0, 4).map((c, i) => (
              <li key={i}>{conflictLabel(c)}</li>
            ))}
          </ul>
          <p className="mt-1.5 opacity-70">You can still save — this is just a heads-up.</p>
        </div>
      ) : null}

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.key} className="glass-panel space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {r.fromCanvas ? r.title : `Class ${i + 1}`}
                {conflictKeys.has(r.key) ? " · overlaps" : ""}
              </p>
              {rows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => setRows((prev) => prev.filter((x) => x.key !== r.key))}
                  className="glass-inset press shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
                >
                  Remove
                </button>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {!r.fromCanvas ? (
                <Field label={hasKey ? "Class name (optional if it's in Canvas)" : "Class name"}>
                  <input
                    value={r.title}
                    onChange={(e) => update(r.key, { title: e.target.value })}
                    placeholder="Calculus 2"
                    maxLength={100}
                    className="field"
                  />
                </Field>
              ) : null}
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

            <div className="flex flex-wrap gap-2">
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
                {r.perDay ? "Using different times each day" : "Different times each day"}
              </button>
              <button
                type="button"
                onClick={() => update(r.key, { details: !r.details })}
                aria-pressed={r.details}
                className={`press min-h-11 rounded-full px-4 text-[11px] font-medium uppercase tracking-[0.14em] ${
                  r.details
                    ? "glass-panel-strong text-foreground"
                    : "glass-inset text-muted-foreground"
                }`}
              >
                {r.details ? "Hide optional details" : "Add optional details"}
              </button>
            </div>

            {r.details ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {r.fromCanvas ? (
                  <Field label="Class name">
                    <input
                      value={r.title}
                      onChange={(e) => update(r.key, { title: e.target.value })}
                      maxLength={100}
                      className="field"
                    />
                  </Field>
                ) : null}
                <Field label="Credit hours">
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
                <Field label="Location">
                  <input
                    value={r.location}
                    onChange={(e) => update(r.key, { location: e.target.value })}
                    placeholder="Room S206"
                    maxLength={100}
                    className="field"
                  />
                </Field>
              </div>
            ) : null}

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
                        className="glass-inset grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 rounded-xl p-3"
                      >
                        <span className="col-span-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:col-span-1 sm:w-20">
                          {DAY_LABELS[d]}
                        </span>
                        <input
                          type="time"
                          value={t.start}
                          onChange={(e) => setDayTime(r.key, d, { start: e.target.value })}
                          aria-label={`${DAY_LABELS[d]} start time`}
                          className="field min-w-0 w-full"
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <input
                          type="time"
                          value={t.end}
                          onChange={(e) => setDayTime(r.key, d, { end: e.target.value })}
                          aria-label={`${DAY_LABELS[d]} end time`}
                          className="field min-w-0 w-full"
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
