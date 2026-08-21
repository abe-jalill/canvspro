// Minimal entry form for a user's recurring class meeting times. Canvas's API
// does not expose section meeting times reliably, so they're entered here and
// stored per-account. Only class name, days and times are required.
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

interface Draft {
  key: string;
  title: string;
  credits: string;
  instructor: string;
  location: string;
  days: ClassDay[];
  start: string;
  end: string;
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
  };
}

function toDraft(s: ClassSession): Draft {
  return {
    key: nextKey(),
    title: s.title,
    credits: s.credits ? String(s.credits) : "",
    instructor: s.instructor,
    location: s.location,
    days: s.days,
    start: toTimeInput(s.startMinutes),
    end: toTimeInput(s.endMinutes),
  };
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
    setRows(sessions.length > 0 ? sessions.map(toDraft) : [emptyDraft()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length]);

  function update(key: string, patch: Partial<Draft>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function toggleDay(key: string, day: ClassDay) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              days: r.days.includes(day)
                ? r.days.filter((d) => d !== day)
                : [...DAY_ORDER].filter((d) => d === day || r.days.includes(d)),
            }
          : r,
      ),
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
      const start = parseTimeInput(r.start);
      const end = parseTimeInput(r.end);
      if (start === null || end === null || end <= start) {
        setStatus(`Check the start and end time for "${r.title.trim()}".`);
        return;
      }
      if (r.days.length === 0) {
        setStatus(`Pick at least one meeting day for "${r.title.trim()}".`);
        return;
      }
      payload.push({
        code: "",
        section: "",
        title: r.title,
        crn: "",
        credits: Number(r.credits) || 0,
        instructor: r.instructor,
        location: r.location,
        campus: "",
        scheduleType: "Lecture",
        days: r.days,
        startMinutes: start,
        endMinutes: end,
        term: "",
        dateRange: "",
      });
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
          professor, and location are optional.
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
