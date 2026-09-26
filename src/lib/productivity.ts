import type { AssignmentItem } from "./canvas.functions";
import type { CompletionRecord } from "./completion-records";
import { isInFocusWindow } from "./focus-window.ts";
import { isAssignmentComplete } from "./assignment-window.ts";

function timestamp(value: string | null | undefined) {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : null;
}
function day(date: Date, offset = 0) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() + offset);
  return result;
}
function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function summarizeProductivity(
  assignments: AssignmentItem[],
  completedIds: Set<string>,
  records: Record<string, CompletionRecord>,
  estimates: Map<number, number | null>,
  now = new Date(),
) {
  const since = day(now, -6).getTime();
  const nextMonday = day(now, 8 - (now.getDay() || 7));
  const nextWeekEnd = day(nextMonday, 7).getTime();
  const completed = new Map<string, { at: number; due: number | null }>();
  for (const [id, row] of Object.entries(records)) {
    const at = timestamp(row.completedAt);
    if (row.completed && at !== null) completed.set(id, { at, due: timestamp(row.dueAt) });
  }
  const remaining: AssignmentItem[] = [];
  for (const a of assignments) {
    const submitted = timestamp(a.submission?.submitted_at);
    if (submitted !== null) completed.set(String(a.id), { at: submitted, due: timestamp(a.due_at) });
    if (!isAssignmentComplete(a, completedIds.has(String(a.id)))) remaining.push(a);
  }
  const recent = [...completed.values()].filter((r) => r.at >= since && r.at <= now.getTime());
  const upcomingByDay = new Map<string, number>();
  const crowded = new Map<string, AssignmentItem[]>();
  let upcoming = 0;
  for (const a of remaining) {
    const due = timestamp(a.due_at);
    if (due === null || due < now.getTime()) continue;
    const key = dayKey(new Date(due));
    if (isInFocusWindow(a, "7", now.getTime(), false)) {
      upcoming++;
      upcomingByDay.set(key, (upcomingByDay.get(key) ?? 0) + 1);
    }
    if (due < nextWeekEnd) crowded.set(key, [...(crowded.get(key) ?? []), a]);
  }
  const major = (a: AssignmentItem) => (estimates.get(a.id) ?? 0) >= 90 || /\b(exam|final|midterm|project|paper|presentation)\b/i.test(a.name);
  const warnings = [...crowded.entries()].sort(([a], [b]) => a.localeCompare(b))
    .filter(([, items]) => items.length >= 3 || items.filter(major).length >= 2)
    .map(([date, items]) => {
      const candidates = items.filter(major);
      const suggested = [...(candidates.length ? candidates : items)].sort((a, b) => (estimates.get(b.id) ?? 0) - (estimates.get(a.id) ?? 0))[0];
      const start = day(new Date(`${date}T12:00:00`), -2);
      return { date, count: items.length, majorCount: candidates.length, suggested, start: start < day(now) ? day(now) : start };
    });
  const busiest = [...upcomingByDay.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    completed: recent.length,
    overdueCleared: recent.filter((r) => r.due !== null && r.at > r.due).length,
    upcoming,
    busiest: busiest ? { date: busiest[0], count: busiest[1] } : null,
    warnings,
  };
}
