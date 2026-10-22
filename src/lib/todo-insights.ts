/**
 * Small numbers that make To-Do more useful: how much an assignment counts,
 * what's left today, and a forgiving weekly rhythm. Pure, so the website and
 * the iPhone app (which ports these rules) give the same answers.
 */

interface Pointed {
  id: number;
  course_id: number;
  points_possible: number | null;
}

/**
 * Share of a class's points this assignment is worth (0–1), or null when the
 * class has no points to compare with. Classes that weight groups can differ,
 * so it's worded as "of class points", never as a grade.
 */
export function pointsShare(item: Pointed, all: Pointed[]): number | null {
  const points = item.points_possible ?? 0;
  if (points <= 0 || item.course_id <= 0) return null;
  const total = all
    .filter((a) => a.course_id === item.course_id && (a.points_possible ?? 0) > 0)
    .reduce((sum, a) => sum + (a.points_possible ?? 0), 0);
  return total > 0 ? points / total : null;
}

/** "12% of class points", for anything worth 3% or more. */
export function impactLabel(share: number | null): string | null {
  if (share == null || share < 0.03) return null;
  return `${Math.round(share * 100)}% of class points`;
}

/** Worth a closer look: 10% or more of the class's points. */
export function isHighImpact(share: number | null): boolean {
  return share != null && share >= 0.1;
}

/**
 * Today's progress: finished items count whole, unfinished ones by their saved
 * progress (a head start counts). `left` is what isn't finished.
 */
export function todayProgress(
  items: { done: boolean; progress: number | null; minutes: number }[],
): { left: number; total: number; fraction: number; minutesLeft: number } {
  const total = items.length;
  const left = items.filter((i) => !i.done).length;
  const credit = items.reduce(
    (sum, i) => sum + (i.done ? 1 : Math.min(Math.max(i.progress ?? 0, 0), 100) / 100),
    0,
  );
  const minutesLeft = items
    .filter((i) => !i.done)
    .reduce(
      (sum, i) => sum + Math.round(i.minutes * (1 - Math.min(i.progress ?? 0, 100) / 100)),
      0,
    );
  return { left, total, fraction: total > 0 ? credit / total : 0, minutesLeft };
}

/** "2 left today", "1 left today", "All done today". */
export function leftTodayLabel(left: number, total: number): string {
  if (total === 0) return "Nothing due today";
  if (left === 0) return "All done today";
  return `${left} left today`;
}

/**
 * The weekly rhythm: which days this Sunday–Saturday week you finished
 * something. Rest days are fine; 4 active days is the gentle aim, and a new
 * week always starts fresh.
 */
export const RHYTHM_KEY = "weekly-rhythm";
export const RHYTHM_AIM = 4;

export function rhythmWeek(completedAt: (string | null | undefined)[], now: number): boolean[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 7 }, () => false);
  for (const at of completedAt) {
    const t = at ? Date.parse(at) : NaN;
    if (!Number.isFinite(t)) continue;
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    const index = Math.round((d.getTime() - start.getTime()) / 86_400_000);
    if (index >= 0 && index < 7) days[index] = true;
  }
  return days;
}

/** One kind line about the week so far. */
export function rhythmLine(days: boolean[], now: number): string {
  const active = days.filter(Boolean).length;
  const dayIndex = new Date(now).getDay();
  if (active === 0)
    return dayIndex <= 1 ? "New week, fresh start." : "Any day is a good day to start.";
  if (active >= RHYTHM_AIM) return `${active} active days this week. Rest is part of the plan.`;
  return `${active} of ${RHYTHM_AIM} active days. Rest days count too.`;
}
