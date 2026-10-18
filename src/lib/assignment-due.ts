/** Due dates use the student's local calendar, including across DST changes. */
export function relativeDueDay(due: string | null, now = Date.now()): "Today" | "Tomorrow" | null {
  if (!due) return null;
  const date = new Date(due);
  if (!Number.isFinite(date.getTime())) return null;
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return null;
}

export function formatAssignmentDue(due: string | null, now = Date.now(), includeTime = true): string {
  if (!due || !Number.isFinite(Date.parse(due))) return "No due date";
  const date = new Date(due);
  const day = relativeDueDay(due, now) ?? date.toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
  return includeTime ? `${day} · ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : day;
}

export function dueTodayClass(due: string | null, completed = false, now = Date.now()): string {
  return !completed && relativeDueDay(due, now) === "Today"
    ? "!border-amber-500/70 ring-1 ring-amber-500/25 dark:!border-amber-400/70"
    : "";
}
