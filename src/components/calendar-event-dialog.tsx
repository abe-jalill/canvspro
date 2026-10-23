import { LocalDatePicker } from "@/components/ui/local-date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { parseTimeInput, toTimeInput } from "@/lib/class-schedule";
import { dayKey, defaultEventTimes, type CalendarEvent } from "@/lib/calendar-events";
import { cn } from "@/lib/utils";

const WEEKDAYS = [
  { day: 0, short: "S", name: "Sunday" },
  { day: 1, short: "M", name: "Monday" },
  { day: 2, short: "T", name: "Tuesday" },
  { day: 3, short: "W", name: "Wednesday" },
  { day: 4, short: "T", name: "Thursday" },
  { day: 5, short: "F", name: "Friday" },
  { day: 6, short: "S", name: "Saturday" },
];

const inputClass =
  "w-full rounded-lg border border-glass-border bg-background/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary";

/**
 * Add or change an event on the Calendar: a meeting, an appointment, practice,
 * anything with a time. It can repeat weekly on chosen days.
 */
export function CalendarEventDialog({
  open,
  onOpenChange,
  event,
  day,
  startMinutes: slotMinutes,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The event to change, or null to add one. */
  event: CalendarEvent | null;
  /** The day a new event starts on (the one picked on the calendar). */
  day: Date | null;
  /** A new event's start, when a time slot on the calendar was clicked. */
  startMinutes?: number | null;
  onSave: (event: Omit<CalendarEvent, "id"> & { id?: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [repeat, setRepeat] = useState<number[]>([]);
  const [until, setUntil] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  // Fill the form each time it opens.
  useEffect(() => {
    if (!open) return;
    if (event) {
      setTitle(event.title);
      setDate(event.date);
      setAllDay(event.start == null);
      setStart(toTimeInput(event.start ?? 9 * 60));
      setEnd(toTimeInput(event.end ?? (event.start ?? 9 * 60) + 60));
      setRepeat(event.repeat);
      setUntil(event.until ?? "");
      setLocation(event.location);
      setNotes(event.notes);
    } else {
      const times = defaultEventTimes();
      const today = dayKey(new Date());
      const picked = day ? dayKey(day) : null;
      // A clicked slot starts there; another day starts at a daytime hour, not "the next hour".
      const startMinutes =
        slotMinutes != null ? slotMinutes : picked && picked !== today ? 10 * 60 : times.start;
      setTitle("");
      setDate(picked && (slotMinutes != null || picked >= today) ? picked : times.date);
      setAllDay(false);
      setStart(toTimeInput(startMinutes));
      setEnd(toTimeInput(Math.min(startMinutes + 60, 23 * 60 + 59)));
      setRepeat([]);
      setUntil("");
      setLocation("");
      setNotes("");
    }
  }, [open, event, day, slotMinutes]);

  const startMinutes = parseTimeInput(start);
  const endMinutes = parseTimeInput(end);
  const timesOk =
    allDay || (startMinutes != null && endMinutes != null && endMinutes > startMinutes);
  const untilOk = !until || until >= date;
  const canSave = title.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && timesOk && untilOk;

  function changeStart(value: string) {
    const before = parseTimeInput(start);
    const next = parseTimeInput(value);
    setStart(value);
    // Moving the start moves the end with it, keeping the same length.
    if (next != null && before != null && endMinutes != null) {
      const length = Math.max(15, endMinutes - before);
      setEnd(toTimeInput(Math.min(next + length, 23 * 60 + 59)));
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    onSave({
      ...(event ? { id: event.id } : {}),
      title: title.trim(),
      date,
      start: allDay ? null : startMinutes,
      end: allDay ? null : endMinutes,
      repeat,
      until: repeat.length > 0 && until ? until : null,
      location: location.trim(),
      notes: notes.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel-strong max-h-[90dvh] overflow-y-auto rounded-2xl sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            Only you see this. It goes on your calendar, not To-Do.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's happening?"
            aria-label="Event name"
            className={inputClass}
            autoFocus
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="space-y-1">
              <span className="text-xs text-muted-foreground">Date</span>
              <LocalDatePicker value={date} onChange={setDate} label="Event date" />
            </label>
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <Switch checked={allDay} onCheckedChange={setAllDay} aria-label="All day" />
              All day
            </label>
          </div>
          {!allDay && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Starts</span>
                <TimePicker value={start} onChange={changeStart} label="Event starts" />
              </label>
              <label className="space-y-1">
                <span className="text-xs text-muted-foreground">Ends</span>
                <TimePicker value={end} onChange={setEnd} label="Event ends" className={cn(!timesOk && "ring-1 ring-destructive")} />
              </label>
              {!timesOk && (
                <p className="col-span-2 text-xs text-destructive">
                  It needs to end after it starts.
                </p>
              )}
            </div>
          )}
          <fieldset className="space-y-2">
            <legend className="text-xs text-muted-foreground">Repeats every week on</legend>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((w) => {
                const on = repeat.includes(w.day);
                return (
                  <button
                    key={w.day}
                    type="button"
                    aria-pressed={on}
                    aria-label={w.name}
                    onClick={() =>
                      setRepeat((list) =>
                        on ? list.filter((d) => d !== w.day) : [...list, w.day].sort(),
                      )
                    }
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-foreground/15 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {w.short}
                  </button>
                );
              })}
            </div>
            {repeat.length > 0 ? (
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">Until (optional)</span>
                <LocalDatePicker value={until} min={date} onChange={setUntil} label="Repeat until" clearable />
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">Leave these off for a one-time event.</p>
            )}
          </fieldset>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location (optional)"
            aria-label="Location"
            className={inputClass}
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            aria-label="Notes"
            rows={2}
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canSave}
              className="min-h-11 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {event ? "Save changes" : "Add to calendar"}
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            {event && (
              <button
                type="button"
                onClick={() => {
                  onDelete(event.id);
                  onOpenChange(false);
                }}
                className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {event.repeat.length > 0 ? "Delete all" : "Delete"}
              </button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
