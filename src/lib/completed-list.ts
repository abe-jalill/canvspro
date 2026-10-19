import type { AssignmentItem } from "./canvas.functions";
import type { CompletionRecord } from "./completion-records";

export interface CompletedEntry {
  assignment: AssignmentItem;
  /** When it was finished: marked done, else submitted, else its due date. */
  doneAt: number | null;
  /** Finished in Canvas (submitted or excused) rather than ticked off here. */
  inCanvas: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function time(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Everything finished, most recent first. */
export function completedEntries(
  assignments: AssignmentItem[],
  isComplete: (assignment: AssignmentItem) => boolean,
  markedDone: (id: number) => boolean,
  records: Record<string, CompletionRecord>,
): CompletedEntry[] {
  return assignments
    .filter(isComplete)
    .map((assignment) => {
      const marked = markedDone(assignment.id);
      const doneAt =
        (marked ? time(records[String(assignment.id)]?.completedAt) : null) ??
        time(assignment.submission?.submitted_at) ??
        time(assignment.due_at);
      return { assignment, doneAt, inCanvas: !marked };
    })
    .sort(
      (a, b) =>
        (b.doneAt ?? -Infinity) - (a.doneAt ?? -Infinity) ||
        a.assignment.name.localeCompare(b.assignment.name),
    );
}

/** "Today", "Yesterday", "This week", "Earlier". */
export function completedGroupLabel(doneAt: number | null, now = Date.now()) {
  if (doneAt == null) return "Earlier";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = today.getTime();
  if (doneAt >= start) return "Today";
  if (doneAt >= start - DAY_MS) return "Yesterday";
  if (doneAt >= start - 6 * DAY_MS) return "This week";
  return "Earlier";
}
