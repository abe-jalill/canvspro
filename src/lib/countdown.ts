// Countdown label + urgency for assignment due dates.
import { formatAssignmentDue, relativeDueDay } from "./assignment-due.ts";

export type Urgency = "overdue" | "today" | "soon" | "later" | "none";

export interface CountdownInfo {
  label: string;         // e.g. "Due today", "3 days left", "Due Oct 14", "Overdue"
  urgency: Urgency;
  daysLeft: number | null;
  fullDate: string;      // e.g. "Fri, Oct 14, 11:59 PM"
}

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

export function getCountdown(
  due: string | null,
  opts?: { completed?: boolean },
): CountdownInfo | null {
  if (!due) return null;
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) return null;

  const now = new Date();
  const fullDate = formatAssignmentDue(due, now.getTime());
  const relative = relativeDueDay(due, now.getTime());

  const daysLeft = Math.round(
    (startOfDay(dueDate).getTime() - startOfDay(now).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  // Completed items never look urgent.
  if (opts?.completed) {
    return {
      label:
        relative ?? (daysLeft >= 0
          ? dueDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "Completed"),
      urgency: "none",
      daysLeft,
      fullDate,
    };
  }

  if (dueDate.getTime() < now.getTime()) {
    return { label: relative ?? "Overdue", urgency: "overdue", daysLeft, fullDate };
  }
  if (daysLeft <= 0) {
    return { label: "Today", urgency: "today", daysLeft, fullDate };
  }
  if (daysLeft === 1) {
    return { label: "Tomorrow", urgency: "soon", daysLeft, fullDate };
  }
  if (daysLeft <= 6) {
    return {
      label: `${daysLeft} days left`,
      urgency: daysLeft <= 3 ? "soon" : "later",
      daysLeft,
      fullDate,
    };
  }
  const label = `Due ${dueDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
  return { label, urgency: "later", daysLeft, fullDate };
}

// Tailwind class helpers — monochrome white/gray urgency, no red/yellow/green.
export function urgencyTextClass(u: Urgency): string {
  switch (u) {
    case "overdue":
    case "today":
      return "text-foreground font-semibold";
    case "soon":
      return "text-foreground/85";
    case "later":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

