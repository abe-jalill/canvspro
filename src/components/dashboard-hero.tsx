import { useEffect, useState } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  Calendar,
  CalendarDays,
  Clock,
  Flame,
  Sparkles,
} from "lucide-react";
import {
  getAllAssignmentsFn,
  getCalendarEventsFn,
  type AssignmentItem,
  type CalendarEventItem,
} from "@/lib/canvas.functions";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { displayCourseName } from "@/lib/course-display";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: 5 * 60_000,
});

const eventsQO = queryOptions({
  queryKey: ["canvas", "calendar"],
  queryFn: () => getCalendarEventsFn(),
  staleTime: 5 * 60_000,
});

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function untilLabel(target: Date, now: Date) {
  const mins = Math.round((target.getTime() - now.getTime()) / 60_000);
  if (mins <= 0) return "Due right now";
  if (mins < 60) return `Due in ${mins}m`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  if (hours < 24) return rest ? `Due in ${hours}h ${rest}m` : `Due in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

interface NextUpItem {
  start: Date;
  title: string;
  course: string | null;
  kind: "assignment" | "event";
}

function nextUp(
  events: CalendarEventItem[] | undefined,
  assignments: AssignmentItem[] | undefined,
  now: Date,
): NextUpItem | null {
  const items: NextUpItem[] = [];
  const endOfWindow = now.getTime() + 7 * 24 * 60 * 60 * 1000;

  for (const e of events ?? []) {
    if (!e.start_at) continue;
    const start = new Date(e.start_at);
    if (
      Number.isNaN(start.getTime()) ||
      start.getTime() <= now.getTime() ||
      start.getTime() > endOfWindow
    )
      continue;
    items.push({
      start,
      title: e.title || "Event",
      course: e.context_name ? displayCourseName(e.context_name, "") : null,
      kind: "event",
    });
  }

  for (const a of assignments ?? []) {
    if (!a.due_at) continue;
    const start = new Date(a.due_at);
    if (
      Number.isNaN(start.getTime()) ||
      start.getTime() < now.getTime() ||
      start.getTime() > endOfWindow
    )
      continue;
    items.push({
      start,
      title: a.name,
      course: displayCourseName(a.course_name, a.course_code),
      kind: "assignment",
    });
  }

  items.sort((a, b) => a.start.getTime() - b.start.getTime());
  return items[0] ?? null;
}

function summarize(
  assignments: AssignmentItem[] | undefined,
  isCompleted: (id: string | number) => boolean,
  now: Date,
) {
  if (!assignments) return null;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfToday = startOfDay.getTime() + 24 * 3_600_000;
  const endOfTomorrow = endOfToday + 24 * 3_600_000;
  const inAWeek = start