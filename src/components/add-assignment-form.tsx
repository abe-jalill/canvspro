import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NO_CLASS_ID } from "@/lib/custom-assignments";
import { suggestedPlanTime } from "@/lib/calendar-events";
import { cn } from "@/lib/utils";

export interface NewCustomAssignment {
  course_id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  notes: string;
  estimated_minutes?: number | null;
}

/** An ISO time as a datetime-local value, in local time. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Your own assignment for a class (Assignments, and To-Do's Add), or with
 * `courseId={NO_CLASS_ID}` a task that isn't for a class: then only what it
 * needs, a name, when it's due and how long it takes.
 */
export function AddAssignmentForm({
  courseId,
  courseLabel,
  courseOptions,
  onAdd,
  onCancel,
  startOpen = false,
  calendarOption = false,
  className,
}: {
  courseId?: number;
  courseLabel?: string;
  courseOptions?: { id: number; label: string }[];
  /** Already inside its own expander: the form, not another button to open it. */
  startOpen?: boolean;
  /** Shown as Back: the form sits in a step it can go back from. */
  onCancel?: () => void;
  /** Offers "Also put it on my calendar", with a time (To-Do's Add). */
  calendarOption?: boolean;
  /** `calendarAt` is set when it should also go on the calendar then. */
  onAdd: (input: NewCustomAssignment, calendarAt?: string) => void;
  className?: string;
}) {
  const personal = courseId === NO_CLASS_ID;
  const [open, setOpen] = useState(startOpen);
  const [name, setName] = useState("");
  const [due, setDue] = useState("");
  const [points, setPoints] = useState("");
  const [notes, setNotes] = useState("");
  const [minutes, setMinutes] = useState("");
  const [selected, setSelected] = useState<string>(courseId != null ? String(courseId) : "");
  const [onCalendar, setOnCalendar] = useState(false);
  /** Empty until the student picks a time; until then it follows the due date. */
  const [planAt, setPlanAt] = useState("");

  const targetId = courseId ?? (selected ? Number(selected) : NaN);
  const validMinutes =
    minutes === "" ||
    (Number.isInteger(Number(minutes)) && Number(minutes) > 0 && Number(minutes) <= 480);
  const dueIso = due ? new Date(due).toISOString() : null;
  const suggested = toLocalInput(
    suggestedPlanTime(dueIso, validMinutes && minutes !== "" ? Number(minutes) : 60),
  );
  const planValue = planAt || suggested;
  const canSave =
    name.trim().length > 0 &&
    Number.isFinite(targetId) &&
    validMinutes &&
    (!onCalendar || Number.isFinite(Date.parse(planValue)));

  function reset() {
    setName("");
    setDue("");
    setPoints("");
    setNotes("");
    setMinutes("");
    setOnCalendar(false);
    setPlanAt("");
    if (courseId == null) setSelected("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    const pts = parseFloat(points);
    onAdd(
      {
        course_id: targetId,
        name: name.trim(),
        due_at: dueIso,
        points_possible: personal || Number.isNaN(pts) ? null : pts,
        notes: personal ? "" : notes.trim(),
        estimated_minutes: minutes === "" ? null : Number(minutes),
      },
      onCalendar ? new Date(planValue).toISOString() : undefined,
    );
    reset();
    if (!startOpen) setOpen(false);
  }

  const inputClass =
    "w-full rounded-lg border border-glass-border bg-background/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="glass-hover mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-glass-border px-3 py-2 text-sm font-medium"
      >
        <Plus className="h-4 w-4" />
        {personal ? "Add task" : `Add assignment${courseLabel ? "" : " to a class"}`}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className={cn("glass-inset mt-3 space-y-3 p-3", className)}>
      {courseId == null && (
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger aria-label="Class">
            <SelectValue placeholder="Choose a class…" />
          </SelectTrigger>
          <SelectContent>
            {(courseOptions ?? []).map((c) => (
              <SelectItem
                key={c.id}
                value={String(c.id)}
                className="whitespace-normal break-words pr-9"
              >
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={personal ? "What do you need to do?" : "Assignment name"}
        aria-label={personal ? "Task name" : "Assignment name"}
        className={inputClass}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs text-muted-foreground">
            {personal ? "Due (optional)" : "Due"}
          </span>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className={inputClass}
          />
        </label>
        {personal ? (
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Time it takes (minutes)</span>
            <input
              type="number"
              min={1}
              max={480}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="e.g. 30"
              className={inputClass}
            />
          </label>
        ) : (
          <label className="space-y-1">
            <span className="text-xs text-muted-foreground">Points</span>
            <input
              type="number"
              min={0}
              step="any"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="e.g. 100"
              className={inputClass}
            />
          </label>
        )}
      </div>
      {!personal && (
        <>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Estimated time (minutes)</span>
            <input
              type="number"
              min={1}
              max={480}
              step={1}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="e.g. 45"
              className={inputClass}
            />
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            aria-label="Notes"
            rows={2}
            className={inputClass}
          />
        </>
      )}
      {calendarOption && (
        <div className="space-y-2 rounded-lg border border-glass-border p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onCalendar}
              onChange={(e) => setOnCalendar(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            Also put it on my calendar
          </label>
          {onCalendar && (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">When you'll work on it</span>
              <input
                type="datetime-local"
                value={planValue}
                onChange={(e) => setPlanAt(e.target.value)}
                aria-label="When you'll work on it"
                className={inputClass}
              />
            </label>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!canSave}
          className="glass-hover min-h-11 rounded-xl border border-glass-border px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {personal ? "Save task" : "Save assignment"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            if (onCancel) onCancel();
            else if (!startOpen) setOpen(false);
          }}
          className="min-h-11 rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          {onCancel ? "Back" : startOpen ? "Clear" : "Cancel"}
        </button>
      </div>
    </form>
  );
}
