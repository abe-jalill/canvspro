// Weekly timetable built from the signed-in user's own Canvas calendar,
// plus any meeting times the user adds by hand.
import { useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { CalendarPlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { getClassMeetingsFn } from "@/lib/canvas.functions";
import { Skeleton, ErrorState } from "@/components/glass-card";
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
import {
  manualToSessions,
  minutesToTimeInput,
  timeToMinutes,
  useManualClasses,
  type ManualClass,
} from "@/lib/manual-class-schedule";

const meetingsQO = queryOptions({
  queryKey: ["canvas", "class-meetings"],
  queryFn: () => getClassMeetingsFn(),
  staleTime: 30 * 60_000,
});

const PX_PER_MIN = 1.4;

export default function LiveClassSchedule() {
  const meetings = useQuery(meetingsQO);
  const manual = useManualClasses();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ManualClass | null>(null);

  const derived = deriveWeeklySchedule(meetings.data ?? []);
  const sessions = [...derived, ...manualToSessions(manual.entries)].sort(
    (a, b) => a.startMinutes - b.startMinutes,
  );
  const byDay = sessionsByDay(sessions);
  const bounds = scheduleBounds(sessions);

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(entry: ManualClass) {
    setEditing(entry);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-6">
      <header className="glass-panel-strong p-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          From your Canvas calendar
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Class Schedule
        </h1>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <Stat label="Meetings" value={String(sessions.length)} />
            <Stat
              label="Days"
              value={String(DAY_ORDER.filter((d) => byDay[d].length > 0).length)}
            />
            <Stat label="Weekly hours" value={weeklyHours(sessions).toFixed(1)} />
          </div>
          <button
            onClick={openNew}
            className="glass-inset glass-hover inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add class time
          </button>
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

      {!meetings.isLoading && !editorOpen && derived.length === 0 && (
        <section className="glass-panel animate-fade-in p-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="glass-inset flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <CalendarPlus className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold tracking-tight">
                  Add your class days and times
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your school doesn&apos;t publish meeting times to Canvas. Add
                  each class once and your weekly timetable fills in.
                </p>
              </div>
            </div>
            <button
              onClick={openNew}
              className="glass-inset glass-hover inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add a class
            </button>
          </div>
        </section>
      )}

      {editorOpen && (
        <ClassTimeForm
          key={editing?.id ?? "new"}
          initial={editing}
          onCancel={() => setEditorOpen(false)}
          onSave={(value) => {
            if (editing) manual.update(editing.id, value);
            else manual.add(value);
            setEditorOpen(false);
            setEditing(null);
          }}
        />
      )}

      {sessions.length > 0 && (
        <>
          <section className="glass-panel animate-fade-in p-4 md:p-6">
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
              {sessions.map((s) => {
                const entry = manual.entries.find(
                  (e) => `manual-${e.id}` === s.id,
                );
                return (
                  <article key={s.id} className="glass-panel animate-fade-in p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {s.context && (
                          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            {s.context}
                          </p>
                        )}
                        <h3 className="mt-1 truncate text-base font-semibold tracking-tight">
                          {s.title}
                        </h3>
                      </div>
                      {entry && (
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            onClick={() => openEdit(entry)}
                            aria-label={`Edit ${entry.name}`}
                            className="glass-hover flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => manual.remove(entry.id)}
                            aria-label={`Remove ${entry.name}`}
                            className="glass-hover flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <dl className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                      <Row label="Days">
                        {s.days.map((d) => DAY_LABELS[d].slice(0, 3)).join(" · ")}
                      </Row>
                      <Row label="Time">{s.timeLabel}</Row>
                      {s.location && <Row label="Location">{s.location}</Row>}
                    </dl>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ClassTimeForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: ManualClass | null;
  onSave: (value: Omit<ManualClass, "id">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [days, setDays] = useState<ClassDay[]>(initial?.days ?? []);
  const [start, setStart] = useState(
    minutesToTimeInput(initial?.startMinutes ?? 9 * 60),
  );
  const [end, setEnd] = useState(
    minutesToTimeInput(initial?.endMinutes ?? 10 * 60),
  );
  const [location, setLocation] = useState(initial?.location ?? "");

  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  const valid = name.trim() !== "" && days.length > 0 && endMinutes > startMinutes;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSave({
          name: name.trim(),
          days,
          startMinutes,
          endMinutes,
          location: location.trim(),
        });
      }}
      className="glass-panel-strong animate-scale-in p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {initial ? "Edit class time" : "Add class time"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the days and times this class meets each week.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="glass-hover flex h-9 w-9 items-center justify-center rounded-lg border border-foreground/15 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Class name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Calculus 2"
            className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-3 text-sm outline-none"
          />
        </Field>
        <Field label="Location (optional)">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Room A210"
            className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-3 text-sm outline-none"
          />
        </Field>
        <Field label="Start time">
          <input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-3 text-sm outline-none"
          />
        </Field>
        <Field label="End time">
          <input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="glass-inset min-h-11 w-full rounded-xl bg-transparent px-3 text-sm outline-none"
          />
        </Field>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Days
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DAY_ORDER.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setDays((prev) =>
                    prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                  )
                }
                className={`min-h-10 rounded-xl px-4 text-sm font-medium transition-all duration-200 ${
                  on
                    ? "bg-foreground text-background"
                    : "glass-inset glass-hover text-muted-foreground"
                }`}
              >
                {DAY_LABELS[d].slice(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!valid}
          className="min-h-11 rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-all duration-200 disabled:opacity-40"
        >
          {initial ? "Save changes" : "Add class"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="glass-inset glass-hover min-h-11 rounded-xl px-5 text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
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
