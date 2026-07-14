// Countdown label + urgency for assignment due dates.

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
  const fullDate = dueDate.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const daysLeft = Math.round(
    (startOfDay(dueDate).getTime() - startOfDay(now).getTime()) /
      (24 * 60 * 60 * 1000),
  );

  // Completed items never look urgent.
  if (opts?.completed) {
    return {
      label:
        daysLeft >= 0
          ? dueDate.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })
          : "Completed",
      urgency: "none",
      daysLeft,
      fullDate,
    };
  }

  if (dueDate.getTime() < now.getTime()) {
    return { label: "Overdue", urgency: "overdue", daysLeft, fullDate };
  }
  if (daysLeft <= 0) {
    return { label: "Due today", urgency: "today", daysLeft, fullDate };
  }
  if (daysLeft === 1) {
    return { label: "Due tomorrow", urgency: "soon", daysLeft, fullDate };
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
      return "text-white font-semibold";
    case "soon":
      return "text-foreground/85";
    case "later":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

export function urgencyAccentClass(u: Urgency): string {
  // Left-border accent on cards. Uses white for urgent, fades for later.
  switch (u) {
    case "overdue":
    case "today":
      return "border-l-2 border-l-white shadow-[0_0_0_1px_rgb(255_255_255/0.15),0_0_24px_-6px_rgb(255_255_255/0.35)]";
    case "soon":
      return "border-l-2 border-l-white/40";
    case "later":
      return "border-l border-l-white/10";
    default:
      return "";
  }
}
