import { useEffect } from "react";
import { useQuery, queryOptions } from "@tanstack/react-query";
import {
  getAllAssignmentsFn,
  getAnnouncementsFn,
  type AssignmentItem,
  type AnnouncementItem,
} from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";
import { notify } from "@/lib/notifications";
import { DUE_WINDOWS, readPrefs } from "@/lib/notification-prefs";
import { COMPLETED_ASSIGNMENTS_KEY } from "@/lib/local-state";
import { scopedKey } from "@/lib/user-scope";

const SEEN_GRADES_KEY = "canvas:seen-graded";
const SEEN_ANNOUNCEMENTS_KEY = "canvas:seen-announcements";

function readSet(baseKey: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(scopedKey(baseKey));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSet(baseKey: string, set: Set<string>) {
  try {
    window.localStorage.setItem(scopedKey(baseKey), JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}


const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: 5 * 60_000,
});

const announcementsQO = queryOptions({
  queryKey: ["canvas", "announcements"],
  queryFn: () => getAnnouncementsFn(),
  staleTime: 5 * 60_000,
});

function runDueChecks(assignments: AssignmentItem[]) {
  const prefs = readPrefs();
  if (!prefs.enabled) return;
  const completed = readSet(COMPLETED_ASSIGNMENTS_KEY);
  const now = Date.now();

  for (const a of assignments) {
    if (!a.due_at) continue;
    if (completed.has(String(a.id))) continue;
    if (a.submission?.submitted_at) continue;
    const due = new Date(a.due_at).getTime();
    if (due <= now) {
      // Overdue: only surface items that slipped in the last week.
      if (now - due <= 7 * 24 * 3_600_000) {
        notify({
          id: `overdue:${a.id}`,
          kind: "overdue",
          title: `Overdue: ${a.name}`,
          course: displayCourseName(a.course_name, a.course_code),
          course_name: a.course_name,
          course_code: a.course_code,
          to: "/assignments",
          body: `was due ${new Date(a.due_at).toLocaleString()}`,
        });
      }
      continue;
    }
    const hoursLeft = (due - now) / 3_600_000;

    for (const w of DUE_WINDOWS) {
      if (!prefs[w.key]) continue;
      if (hoursLeft > w.hours) continue;
      // only fire the tightest matching window that is enabled
      const tighter = DUE_WINDOWS.filter(
        (x) => prefs[x.key] && x.hours < w.hours && hoursLeft <= x.hours,
      );
      if (tighter.length > 0) continue;
      notify({
        id: `due:${a.id}:${w.key}`,
        kind: "due",
        title: `Due ${w.label.replace(" before", "")} or less: ${a.name}`,
        course: displayCourseName(a.course_name, a.course_code),
        course_name: a.course_name,
        course_code: a.course_code,
        to: "/assignments",
        body: `due ${new Date(a.due_at).toLocaleString()}`,
      });

    }
  }
}

function runGradeChecks(assignments: AssignmentItem[]) {
  const prefs = readPrefs();
  const seen = readSet(SEEN_GRADES_KEY);
  const first = seen.size === 0;
  let changed = false;

  for (const a of assignments) {
    const score = a.submission?.score;
    if (score == null) continue;
    const key = `${a.id}:${score}`;
    if (seen.has(key)) continue;
    seen.add(key);
    changed = true;
    if (first) continue; // baseline pass: don't spam existing grades
    if (!prefs.enabled || !prefs.grades) continue;
    const total = a.points_possible;
    if (!total) continue;
    const pct = Math.round((score / total) * 100);
    if (pct < prefs.gradeThreshold) continue;
    notify({
      id: `grade:${key}`,
      kind: "grade",
      title: `Good job! You scored ${pct}% on ${a.name}!`,
      course: displayCourseName(a.course_name, a.course_code),
      course_name: a.course_name,
      course_code: a.course_code,
      to: "/grades",
    });

  }

  if (changed) writeSet(SEEN_GRADES_KEY, seen);
}

function runAnnouncementChecks(items: AnnouncementItem[]) {
  const prefs = readPrefs();
  const seen = readSet(SEEN_ANNOUNCEMENTS_KEY);
  const first = seen.size === 0;
  let changed = false;

  for (const a of items) {
    const key = String(a.id);
    if (seen.has(key)) continue;
    seen.add(key);
    changed = true;
    if (first) continue;
    if (!prefs.enabled || !prefs.announcements) continue;
    notify({
      id: `announcement:${key}`,
      kind: "announcement",
      title: a.title,
      course: displayCourseName(a.course_name, a.course_code),
      course_name: a.course_name,
      course_code: a.course_code,
      to: "/announcements",
      body: "New announcement",
    });

  }

  if (changed) writeSet(SEEN_ANNOUNCEMENTS_KEY, seen);
}

/** Watches Canvas data and turns it into in-app + browser notifications. */
export function useNotificationEngine(enabled = true) {
  const assignments = useQuery({ ...assignmentsQO, enabled });
  const announcements = useQuery({ ...announcementsQO, enabled });

  useEffect(() => {
    if (!enabled || !assignments.data) return;
    runGradeChecks(assignments.data);
    runDueChecks(assignments.data);
    const id = setInterval(() => {
      if (assignments.data) runDueChecks(assignments.data);
    }, 15 * 60_000);
    return () => clearInterval(id);
  }, [assignments.data, enabled]);

  useEffect(() => {
    if (!enabled || !announcements.data) return;
    runAnnouncementChecks(announcements.data);
  }, [announcements.data, enabled]);
}
