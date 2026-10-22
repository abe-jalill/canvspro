import { forwardRef, useMemo, useState } from "react";
import { CalendarClock, Clock, CornerDownLeft, GraduationCap, Zap } from "lucide-react";
import { toast } from "sonner";
import { parseQuickAdd, type QuickCourse } from "@/lib/quick-add";
import { NO_CLASS_ID, type CustomAssignment } from "@/lib/custom-assignments";
import type { NewCustomAssignment } from "@/components/add-assignment-form";
import { formatMinutes } from "@/lib/format-minutes";

/**
 * Type a task the way you'd jot it down — "Read ch4 bio fri 30m" — and see what
 * it understood before saving: the class, when it's due, how long it takes.
 */
export const QuickAdd = forwardRef<
  HTMLInputElement,
  {
    courses: (QuickCourse & { label: string })[];
    onAdd: (input: NewCustomAssignment) => CustomAssignment | Promise<CustomAssignment>;
  }
>(function QuickAdd({ courses, onAdd }, ref) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseQuickAdd(text, courses), [text, courses]);
  const course = courses.find((c) => c.id === parsed.courseId);
  const ready = parsed.name.length > 0;

  const [saving, setSaving] = useState(false);
  async function save() {
    if (!ready || saving) return;
    setSaving(true);
    try {
      await onAdd({
        course_id: parsed.courseId ?? NO_CLASS_ID,
        name: parsed.name,
        due_at: parsed.dueAt,
        points_possible: null,
        notes: "",
        estimated_minutes: parsed.minutes,
      });
      toast.success(`Added "${parsed.name}"`);
      setText("");
    } catch {
      toast.error("Couldn't add that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const due = parsed.dueAt
    ? new Date(parsed.dueAt).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="rounded-xl border border-foreground/15 px-3 py-2 focus-within:border-foreground/30"
    >
      <label className="flex items-center gap-2.5">
        <Zap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">Quick add a task</span>
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Quick add: Read ch4 bio fri 30m"
          className="min-h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {ready && (
          <button
            type="submit"
            disabled={saving}
            className="press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
          >
            Add
            <CornerDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </label>
      {/* What it understood, before it's saved. */}
      {ready && (
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 pb-0.5 text-xs" aria-live="polite">
          <span className="font-medium">{parsed.name}</span>
          <Chip icon={<GraduationCap className="h-3 w-3" />}>
            {course ? course.label : "Personal"}
          </Chip>
          <Chip icon={<CalendarClock className="h-3 w-3" />}>{due ?? "No due date"}</Chip>
          {parsed.minutes != null && (
            <Chip icon={<Clock className="h-3 w-3" />}>{formatMinutes(parsed.minutes)}</Chip>
          )}
        </p>
      )}
    </form>
  );
});

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2 py-0.5 text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}
