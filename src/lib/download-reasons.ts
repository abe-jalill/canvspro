import type { WidgetId } from "./dashboard-layout";

/**
 * "Why did you download CoursePro?" — asked once, after Canvas is connected.
 * The answers choose the dashboard's cards and their order. The iPhone app asks
 * the same question with the same answers (and leaves out cards it doesn't draw).
 */
export const DOWNLOAD_REASONS_KEY = "download-reasons";

export interface DownloadReason {
  id: string;
  label: string;
  /** How much each card helps with this reason. */
  widgets: Partial<Record<WidgetId, number>>;
}

export const DOWNLOAD_REASONS: DownloadReason[] = [
  {
    id: "deadlines",
    label: "Never miss a deadline",
    widgets: { focus: 3, upcoming: 2, calendar: 1 },
  },
  { id: "grades", label: "Keep my grades up", widgets: { classes: 3, focus: 1 } },
  { id: "plan", label: "Plan my week", widgets: { calendar: 3, upcoming: 2, heatmap: 2 } },
  { id: "procrastination", label: "Stop putting things off", widgets: { focus: 3, digest: 1 } },
  { id: "study", label: "Focus when I study", widgets: { focus: 2, heatmap: 1 } },
  {
    id: "overview",
    label: "See all my classes in one place",
    widgets: { classes: 2, upcoming: 2, digest: 2 },
  },
  {
    id: "announcements",
    label: "Keep up with announcements",
    widgets: { announcements: 3, digest: 2 },
  },
  {
    id: "balance",
    label: "Balance school with work or sports",
    widgets: { calendar: 3, heatmap: 2 },
  },
  { id: "gpa", label: "Track my GPA", widgets: { gpa: 3, classes: 2 } },
  {
    id: "stress",
    label: "Feel less stressed about school",
    widgets: { focus: 2, digest: 1, heatmap: 1 },
  },
];

/** Cards that make a good start when the answers point to only one or two. */
const FALLBACK: WidgetId[] = ["digest", "focus", "upcoming", "classes"];
export const MAX_RECOMMENDED = 5;

/**
 * The cards for these answers, most helpful first (ties in `order`), at most
 * five and at least three. `available` leaves out cards a device doesn't draw.
 */
export function recommendWidgets(
  reasonIds: string[],
  order: WidgetId[],
  available: (id: WidgetId) => boolean = () => true,
): WidgetId[] {
  const score = new Map<WidgetId, number>();
  for (const reason of DOWNLOAD_REASONS) {
    if (!reasonIds.includes(reason.id)) continue;
    for (const [id, points] of Object.entries(reason.widgets) as [WidgetId, number][]) {
      if (available(id)) score.set(id, (score.get(id) ?? 0) + points);
    }
  }
  const picks = order
    .filter((id) => (score.get(id) ?? 0) > 0)
    .sort(
      (a, b) => (score.get(b) ?? 0) - (score.get(a) ?? 0) || order.indexOf(a) - order.indexOf(b),
    )
    .slice(0, MAX_RECOMMENDED);
  for (const id of FALLBACK) {
    if (picks.length >= 3) break;
    if (available(id) && !picks.includes(id)) picks.push(id);
  }
  return picks;
}
