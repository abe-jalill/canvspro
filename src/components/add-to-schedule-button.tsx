import { CalendarCheck, CalendarPlus } from "lucide-react";
import { displayCourseName } from "@/lib/course-display";
import {
  useAddAssignmentToSchedule,
  useRemoveAssignmentFromSchedule,
  useScheduledAssignmentIds,
} from "@/lib/scheduled-assignments";
import { cn } from "@/lib/utils";

export interface CalendarAssignment {
  id: number;
  name: string;
  course_id: number;
  course_name?: string | null;
  course_code?: string | null;
  due_at: string | null;
  html_url?: string | null;
}

/**
 * Adds an assignment's due date to the user's class schedule (shown in blue),
 * and removes it again when pressed while already added.
 */
export function AddToScheduleButton({
  assignment,
  size = "md",
  stopPropagation = false,
}: {
  assignment: CalendarAssignment;
  size?: "sm" | "md";
  stopPropagation?: boolean;
}) {
  const added = useScheduledAssignmentIds();
  const add = useAddAssignmentToSchedule();
  const remove = useRemoveAssignmentFromSchedule();
  const isAdded = added.has(assignment.id);
  const busy = add.isPending || remove.isPending;

  const onClick = (e: React.MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    if (!assignment.due_at) return;
    if (isAdded) {
      remove.mutate(assignment.id);
      return;
    }
    add.mutate({
      assignmentId: assignment.id,
      courseId: assignment.course_id ?? null,
      title: assignment.name,
      courseLabel: displayCourseName(
        assignment.course_name ?? undefined,
        assignment.course_code ?? undefined,
      ),
      dueAt: new Date(assignment.due_at).toISOString(),
      htmlUrl: assignment.html_url ?? null,
    });
  };

  const Icon = isAdded ? CalendarCheck : CalendarPlus;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || !assignment.due_at}
      aria-label={
        isAdded
          ? `Remove ${assignment.name} from your class schedule`
          : `Add ${assignment.name} to your class schedule`
      }
      title={
        isAdded ? "On your class schedule — tap to remove" : "Add to class schedule"
      }
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-40",
        size === "sm" ? "h-7 w-7 rounded-md" : "h-8 w-8",
        isAdded
          ? "border-event/50 bg-event/15 text-event"
          : "glass-hover border-glass-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}
