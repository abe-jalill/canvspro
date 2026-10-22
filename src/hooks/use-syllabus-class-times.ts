import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { coursesQueryOptions } from "@/lib/canvas.queries";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import {
  addClassScheduleEntries,
  classScheduleQueryKey,
  useClassSchedule,
} from "@/lib/user-class-schedule";
import { matchScheduleCourse } from "@/lib/class-schedule";
import { displayCourseNameForCourse } from "@/lib/course-display";
import { findClassTimes } from "@/lib/syllabus-times";

/**
 * Which classes' syllabi have been read, saved to the account so it happens
 * once (on any device): course id → "added", "had" (times already entered),
 * or "none:<hash>" (nothing found; read again if the syllabus changes).
 */
export const SYLLABUS_SCAN_KEY = "syllabus-scan";

function readScan(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

/** A short fingerprint of a syllabus, to notice when the teacher changes it. */
export function syllabusHash(text: string | null | undefined): string {
  let h = 0;
  for (const ch of text ?? "") h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Reads each class's syllabus for its meeting days and times and adds them to
 * My classes, so they show on the Calendar. Classes that already have times
 * are left alone, and anything added can be edited or deleted in My classes.
 */
export function useSyllabusClassTimes(enabled: boolean) {
  const courses = useQuery(coursesQueryOptions);
  const schedule = useClassSchedule();
  const scanned = useUserPreferenceKey<unknown>(SYLLABUS_SCAN_KEY, null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const running = useRef(false);
  const gaveUp = useRef(false);

  useEffect(() => {
    if (
      !enabled ||
      running.current ||
      gaveUp.current ||
      !courses.data ||
      !schedule.data ||
      !scanned.ready
    )
      return;
    const done = readScan(scanned.value);
    const todo = courses.data.filter((course) => {
      const state = done[String(course.id)];
      if (!state) return true;
      return state.startsWith("none:") && state !== `none:${syllabusHash(course.syllabus_body)}`;
    });
    if (todo.length === 0) return;

    const next = { ...done };
    const rows: Parameters<typeof addClassScheduleEntries>[0] = [];
    const names: string[] = [];
    for (const course of todo) {
      const name = displayCourseNameForCourse(course.id, course.name, course.course_code);
      const has = schedule.data.some(
        (entry) =>
          entry.canvasCourseId === course.id ||
          matchScheduleCourse(entry.title, entry.code, [{ ...course, display: name }]) != null,
      );
      if (has) {
        next[String(course.id)] = "had";
        continue;
      }
      const found = findClassTimes(course.syllabus_body);
      if (found.length === 0) {
        next[String(course.id)] = `none:${syllabusHash(course.syllabus_body)}`;
        continue;
      }
      next[String(course.id)] = "added";
      names.push(name);
      for (const meeting of found) {
        rows.push({
          // A lab keeps its own name, so editing the class never merges it into the lecture.
          title: meeting.kind === "Lecture" ? name : `${name} ${meeting.kind}`,
          code: course.course_code ?? "",
          section: "",
          crn: "",
          credits: 0,
          instructor: "",
          location: meeting.location,
          campus: "",
          scheduleType: meeting.kind,
          days: meeting.days,
          startMinutes: meeting.startMinutes,
          endMinutes: meeting.endMinutes,
          term: "",
          dateRange: "",
          canvasCourseId: course.id,
        });
      }
    }

    running.current = true;
    void (async () => {
      try {
        // Marked first, so a second tab or device doesn't add the same times.
        await scanned.setAsync(next);
        if (rows.length > 0) {
          await addClassScheduleEntries(rows);
          await queryClient.invalidateQueries({ queryKey: classScheduleQueryKey });
          toast.success(
            names.length === 1
              ? `Added ${names[0]}'s class times from its syllabus`
              : `Added class times for ${names.length} classes from their syllabi`,
            {
              description: "They're on your calendar. Check them in My classes.",
              action: { label: "Review", onClick: () => void navigate({ to: "/class-schedule" }) },
            },
          );
        }
      } catch {
        // Not saved: the next visit tries again (not this one, in a loop).
        gaveUp.current = true;
        await scanned.setAsync(done).catch(() => undefined);
      } finally {
        running.current = false;
      }
    })();
  }, [
    enabled,
    courses.data,
    schedule.data,
    scanned.ready,
    scanned.value,
    scanned,
    queryClient,
    navigate,
  ]);
}
