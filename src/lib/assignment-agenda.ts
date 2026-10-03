import type { AssignmentItem } from "./canvas.functions.ts";
import { endOfUpcomingDay } from "./assignment-window.ts";

export type AgendaHorizon = 14 | 28;

export type AgendaSectionKey = "overdue" | "week1" | "week2" | "weeks34" | "later" | "undated";

export interface AgendaSection<T> {
  key: AgendaSectionKey;
  title: string;
  detail: string;
  items: T[];
}

export interface AgendaView<T> {
  sections: AgendaSection<T>[];
  /** Due in weeks 3-4 but hidden because the horizon is two weeks. */
  hiddenWeeks34: number;
  /** Due after four weeks and hidden (search still finds these). */
  hiddenBeyond: number;
}

/**
 * Splits dated work into calm, short sections. By default only overdue work
 * and the next two weeks show; weeks 3-4 appear on request. While searching,
 * nothing is hidden. `items` must already be sorted soonest first.
 */
export function buildAgendaView<T extends { assignment: Pick<AssignmentItem, "due_at"> }>(
  items: T[],
  now: number,
  horizon: AgendaHorizon,
  searching: boolean,
): AgendaView<T> {
  const week1End = endOfUpcomingDay(now, 7);
  const week2End = endOfUpcomingDay(now, 14);
  const week4End = endOfUpcomingDay(now, 28);
  const due = (item: T) => (item.assignment.due_at ? new Date(item.assignment.due_at).getTime() : null);
  const inRange = (item: T, from: number, to: number) => {
    const t = due(item);
    return t != null && t > from && t <= to;
  };

  const overdue = items.filter((item) => {
    const t = due(item);
    return t != null && t < now;
  });
  const week1 = items.filter((item) => inRange(item, now - 1, week1End));
  const week2 = items.filter((item) => inRange(item, week1End, week2End));
  const weeks34 = items.filter((item) => inRange(item, week2End, week4End));
  const later = items.filter((item) => {
    const t = due(item);
    return t != null && t > week4End;
  });
  const undated = items.filter((item) => due(item) == null);

  const showWeeks34 = horizon === 28 || searching;
  const candidates: AgendaSection<T>[] = [
    { key: "overdue", title: "Overdue", detail: "Worth a look first", items: overdue },
    { key: "week1", title: "Next 7 days", detail: "Your immediate runway", items: week1 },
    { key: "week2", title: "Following week", detail: "Coming up", items: week2 },
    { key: "weeks34", title: "Weeks 3 and 4", detail: "Further ahead", items: showWeeks34 ? weeks34 : [] },
    { key: "later", title: "Later", detail: "Beyond four weeks", items: searching ? later : [] },
    { key: "undated", title: "No due date", detail: "Keep these on your radar", items: undated },
  ];
  const sections = candidates.filter((section) => section.items.length > 0);

  return {
    sections,
    hiddenWeeks34: showWeeks34 ? 0 : weeks34.length,
    hiddenBeyond: searching ? 0 : later.length,
  };
}
