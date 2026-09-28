import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  getCalendarEventsFn,
  type CourseSummary,
  type AssignmentItem,
  type AnnouncementItem,
} from "@/lib/canvas.functions";
import { GlassCard, Skeleton, EmptyState } from "@/components/glass-card";
import { displayCourseNameForCourse } from "@/lib/course-display";
import { getGradeColor, getGradeBg, letterFromScore } from "@/lib/grade-color";
import { useClassSchedule } from "@/lib/user-class-schedule";
import { DAY_LABELS } from "@/lib/class-schedule";
import { ArrowLeft, Calendar, Clock, ExternalLink, CheckCircle2, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import { COMPLETED_ASSIGNMENTS_KEY, useLocalSet } from "@/lib/local-state";
import { isAssignmentComplete } from "@/lib/assignment-window";

const THREE_WEEKS_MS = 3 * 7 * 24 * 60 * 60 * 1000;

import {
  coursesQueryOptions as coursesQO,
  assignmentsQueryOptions as assignmentsQO,
  announcementsQueryOptions as announcementsQO,
  calendarQueryOptions as eventsQO,
} from "@/lib/canvas.queries";
import { SkeletonBlock, AssignmentRowSkeleton } from "@/components/skeletons/dashboard-skeletons";

export const Route = createFileRoute("/_authenticated/courses/$courseId")({
  head: () => ({
    meta: [
      { title: "Class Details — CanvasPro" },
      {
        name: "description",
        content: "Individual course overview, grades, assignments, and announcements.",
      },
    ],
  }),
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(coursesQO);
      void context.queryClient.ensureQueryData(assignmentsQO);
    }
  },
  component: CourseDetailPage,
});

/**
 * Ease-out count-up animation that transitions numbers fast initially,
 * then progressively slower and slower as it approaches the final grade.
 */
function AnimatedGradeCounter({
  score,
  duration = 1600,
}: {
  score: number | null | undefined;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (score == null || isNaN(score)) return;
    let start: number | null = null;
    let frameId: number;

    function step(timestamp: number) {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      // Quartic ease-out curve: starts at high velocity and decelerates steadily
      const easeOut = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(easeOut * score!);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(score!);
      }
    }

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [score, duration]);

  if (score == null) {
    return <span className="text-3xl font-medium text-muted-foreground">—</span>;
  }

  return (
    <span
      className="text-5xl font-semibold tracking-tight tabular-nums transition-colors duration-500"
      style={{ color: getGradeColor(score) }}
    >
      {displayValue.toFixed(1)}%
    </span>
  );
}

function CourseDetailPage() {
  const params = Route.useParams() as { courseId?: string };
  const courseIdStr = params?.courseId ?? "";
  const numericCourseId = Number(courseIdStr);

  const coursesQueryState = useQuery(coursesQO);
  const assignmentsQueryState = useQuery(assignmentsQO);
  const announcementsQueryState = useQuery(announcementsQO);
  const calendarQueryState = useQuery(eventsQO);
  const classSchedule = useClassSchedule();
  const { has: isCompleted } = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const [activeTab, setActiveTab] = useState<"all" | "upcoming" | "graded" | "announcements">(
    "all",
  );
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);

  const course: CourseSummary | undefined = useMemo(() => {
    return coursesQueryState.data?.find(
      (c) => c.id === numericCourseId || String(c.id) === courseIdStr,
    );
  }, [coursesQueryState.data, numericCourseId, courseIdStr]);

  const courseName = course
    ? displayCourseNameForCourse(course.id, course.name, course.course_code)
    : "Class Overview";

  // Check matching dates and times from user class schedule or calendar events
  const matchingSchedule = useMemo(() => {
    if (!course) return null;
    const cName = course.name.toLowerCase();
    const cCode = course.course_code.toLowerCase();

    // 1. First check user's saved timetable schedule entries.
    // Match against the raw Canvas name/code AND the name actually shown on
    // this page (nickname / cleaned title), so an entry that is identical to
    // the class name the user sees always matches.
    const norm = (v: string) =>
      v
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9 ]/g, "")
        .trim();
    const candidates = new Set(
      [course.name, course.course_code, courseName].map(norm).filter((v) => v.length > 0),
    );
    const matches = (classSchedule.data ?? []).filter((s) => {
      const titles = [s.title, s.displayName].map(norm).filter((v) => v.length > 0);
      const sCode = norm(s.code);
      for (const t of titles) {
        for (const c of candidates) {
          if (t === c) return true;
          if (t.length > 3 && c.includes(t)) return true;
          if (c.length > 3 && t.includes(c)) return true;
        }
      }
      if (sCode.length > 2 && candidates.has(sCode)) return true;
      if (sCode.length > 2 && cCode.includes(sCode.toLowerCase())) return true;
      return false;
    });

    const withDays = matches.filter((s) => s.days && s.days.length > 0);
    if (withDays.length > 0) {
      // One class can have several entries (per-day times); show them all.
      const text = withDays
        .map((s) => {
          const daysStr = s.days.map((d) => DAY_LABELS[d] ?? d).join(", ");
          return `${daysStr} • ${s.timeLabel}${s.location ? ` • ${s.location}` : ""}`;
        })
        .join("  |  ");
      return { text, hasEntry: true };
    }

    // 2. Check calendar events for this course
    const calEvent = calendarQueryState.data?.find((e) => {
      if (e.context_code === `course_${course.id}`) return true;
      const title = e.title.toLowerCase();
      return title.includes(cCode) || title.includes(cName);
    });

    if (calEvent && calEvent.start_at) {
      const d = new Date(calEvent.start_at);
      const dayName = d.toLocaleDateString(undefined, { weekday: "short" });
      const timeStr = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
      return {
        text: `${dayName} at ${timeStr}${calEvent.location_name ? ` • ${calEvent.location_name}` : ""}`,
        hasEntry: true,
      };
    }

    return null;
  }, [course, courseName, classSchedule.data, calendarQueryState.data]);

  // Filter assignments for this course
  const courseAssignments = useMemo(() => {
    if (!course || !assignmentsQueryState.data) return [];
    return assignmentsQueryState.data.filter((a) => a.course_id === course.id);
  }, [course, assignmentsQueryState.data]);

  // Use the same completion rule as Focus, so a class cannot call a manually
  // completed or graded task upcoming while Focus correctly excludes it.
  const upcomingAssignments = useMemo(() => {
    return courseAssignments
      .filter((a) => !isAssignmentComplete(a, isCompleted(a.id)))
      .sort((a, b) => {
        if (!a.due_at) return 1;
        if (!b.due_at) return -1;
        return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
      });
  }, [courseAssignments, isCompleted]);

  // Upcoming assignments due within the next 3 weeks; anything further out
  // hides behind "View all".
  const upcomingWithinWindow = useMemo(() => {
    const cutoff = Date.now() + THREE_WEEKS_MS;
    return upcomingAssignments.filter((a) => {
      if (!a.due_at) return true;
      const t = new Date(a.due_at).getTime();
      if (Number.isNaN(t)) return true;
      return t <= cutoff;
    });
  }, [upcomingAssignments]);

  // Graded assignments: has score or workflow_state === 'graded'
  const gradedAssignments = useMemo(() => {
    return courseAssignments
      .filter((a) => a.submission?.score != null || Boolean(a.submission?.grade))
      .sort((a, b) => {
        const dateA = a.submission?.submitted_at ?? a.due_at ?? "";
        const dateB = b.submission?.submitted_at ?? b.due_at ?? "";
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });
  }, [courseAssignments]);

  // Course announcements
  const courseAnnouncements = useMemo(() => {
    if (!course || !announcementsQueryState.data) return [];
    return announcementsQueryState.data
      .filter(
        (item: AnnouncementItem) =>
          item.course_id === course.id || item.context_code === `course_${course.id}`,
      )
      .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
  }, [course, announcementsQueryState.data]);

  // Announcements posted within the past 3 weeks; older ones hide behind
  // "View all".
  const announcementsWithinWindow = useMemo(() => {
    const cutoff = Date.now() - THREE_WEEKS_MS;
    return courseAnnouncements.filter((item) => {
      if (!item.posted_at) return true;
      const t = new Date(item.posted_at).getTime();
      if (Number.isNaN(t)) return true;
      return t >= cutoff;
    });
  }, [courseAnnouncements]);

  const score = course?.current_score;
  const gradeColor = getGradeColor(score);
  const gradeBg = getGradeBg(score);
  const letterGrade = course?.current_grade || letterFromScore(score);

  const loading = coursesQueryState.isLoading || assignmentsQueryState.isLoading;

  if (loading && !course) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        {/* Top Header & Back Navigation */}
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-5 w-24" />
          <SkeletonBlock className="h-7 w-36 rounded-full" />
        </div>

        {/* Hero Class Card */}
        <GlassCard strong className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3 min-w-0">
              <SkeletonBlock className="h-4 w-20 rounded-full" />
              <SkeletonBlock className="h-8 w-64 sm:w-80" />
              <SkeletonBlock className="h-4 w-40" />
            </div>
            <div className="flex items-baseline gap-3 shrink-0">
              <SkeletonBlock className="h-12 w-24" />
              <SkeletonBlock className="h-7 w-10 rounded-lg" />
            </div>
          </div>
        </GlassCard>

        {/* Tabs Bar Skeleton */}
        <div className="flex gap-2">
          <SkeletonBlock className="h-9 w-16 rounded-xl" />
          <SkeletonBlock className="h-9 w-24 rounded-xl" />
          <SkeletonBlock className="h-9 w-20 rounded-xl" />
          <SkeletonBlock className="h-9 w-28 rounded-xl" />
        </div>

        {/* Assignment Skeletons */}
        <div className="space-y-3">
          <AssignmentRowSkeleton index={0} />
          <AssignmentRowSkeleton index={1} />
          <AssignmentRowSkeleton index={2} />
        </div>
      </div>
    );
  }

  if (!course && !loading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
        <GlassCard className="p-8 text-center">
          <p className="mb-1 text-base font-medium text-foreground">Class not found</p>
          <p className="mb-5 text-sm text-muted-foreground">
            This class isn't in your active Canvas enrollments.
          </p>
          <Link
            to="/grades"
            className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
      {/* Top Header & Back Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/grades"
          className="story-link inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All Grades
        </Link>

        {/* Schedule / Meeting time chip */}
        {matchingSchedule ? (
          <span className="glass-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {matchingSchedule.text}
          </span>
        ) : (
          <Link
            to="/class-schedule"
            className="glass-inset inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            Enter class time/days
          </Link>
        )}
      </div>

      {/* Hero Class Card: Title, Code, and Animated Grade Counter */}
      <GlassCard strong className="relative overflow-hidden p-6 sm:p-8">
        {/* Subtle dynamic ambient glow matching current grade color */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl transition-colors duration-700"
          style={{ background: gradeBg }}
        />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="glass-inset rounded-full px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                {course?.course_code || "Course"}
              </span>
            </div>

            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {courseName}
            </h1>

            {/* Dates & Times directly under the class name */}
            <div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
              {matchingSchedule ? (
                <>
                  <Clock className="h-4 w-4 shrink-0" />
                  <span className="truncate">{matchingSchedule.text}</span>
                </>
              ) : (
                <Link to="/class-schedule" className="story-link inline-flex items-center gap-1.5">
                  <CalendarPlus className="h-4 w-4 shrink-0" />
                  <span>Enter class time/days</span>
                </Link>
              )}
            </div>
          </div>

          {/* Grade Card Box with the Ease-Out Decelerating Count-Up */}
          <div className="glass-inset shrink-0 rounded-2xl p-5 text-center sm:min-w-[180px]">
            <p className="mb-1 text-[11px] uppercase tracking-widest text-muted-foreground">
              Current Grade
            </p>

            <AnimatedGradeCounter score={score} />

            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span
                className="rounded-full px-2 py-0.5 font-medium"
                style={{ color: gradeColor, background: gradeBg }}
              >
                {letterGrade}
              </span>
              <span>
                {courseAssignments.length} assignment{courseAssignments.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Quick Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={cn(
            "rounded-xl px-3.5 py-1.5 text-xs transition-all font-normal",
            activeTab === "all"
              ? "bg-foreground text-background font-medium"
              : "glass-hover glass-inset text-muted-foreground hover:text-foreground",
          )}
        >
          All Sections
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={cn(
            "rounded-xl px-3.5 py-1.5 text-xs transition-all font-normal flex items-center gap-1.5",
            activeTab === "upcoming"
              ? "bg-foreground text-background font-medium"
              : "glass-hover glass-inset text-muted-foreground hover:text-foreground",
          )}
        >
          Upcoming
          <span className="glass-inset rounded-full px-1.5 py-0.5 text-[10px] tabular-nums">
            {upcomingAssignments.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("graded")}
          className={cn(
            "rounded-xl px-3.5 py-1.5 text-xs transition-all font-normal flex items-center gap-1.5",
            activeTab === "graded"
              ? "bg-foreground text-background font-medium"
              : "glass-hover glass-inset text-muted-foreground hover:text-foreground",
          )}
        >
          Graded
          <span className="glass-inset rounded-full px-1.5 py-0.5 text-[10px] tabular-nums">
            {gradedAssignments.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("announcements")}
          className={cn(
            "rounded-xl px-3.5 py-1.5 text-xs transition-all font-normal flex items-center gap-1.5",
            activeTab === "announcements"
              ? "bg-foreground text-background font-medium"
              : "glass-hover glass-inset text-muted-foreground hover:text-foreground",
          )}
        >
          Announcements
          <span className="glass-inset rounded-full px-1.5 py-0.5 text-[10px] tabular-nums">
            {courseAnnouncements.length}
          </span>
        </button>
      </div>

      {/* Section 1: Upcoming Assignments */}
      {(activeTab === "all" || activeTab === "upcoming") && (
        <section className="space-y-3">
          <h2 className="px-1 text-xs uppercase tracking-widest text-muted-foreground">Upcoming</h2>
          {(() => {
            const shown = showAllUpcoming ? upcomingAssignments : upcomingWithinWindow;
            const hiddenCount = upcomingAssignments.length - upcomingWithinWindow.length;
            if (upcomingAssignments.length === 0) {
              return (
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  message="All caught up! No upcoming assignments due for this class."
                />
              );
            }
            return (
              <div className="space-y-2.5">
                {!showAllUpcoming && hiddenCount > 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Only showing for the next 3 weeks ·{" "}
                    <button
                      type="button"
                      onClick={() => setShowAllUpcoming(true)}
                      className="font-medium text-foreground/80 underline decoration-foreground/30 underline-offset-2 transition-colors hover:text-foreground"
                    >
                      View all
                    </button>
                  </p>
                )}
                {showAllUpcoming && hiddenCount > 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Showing all {upcomingAssignments.length} ·{" "}
                    <button
                      type="button"
                      onClick={() => setShowAllUpcoming(false)}
                      className="font-medium text-foreground/80 underline decoration-foreground/30 underline-offset-2 transition-colors hover:text-foreground"
                    >
                      Show less
                    </button>
                  </p>
                )}
                {shown.map((a) => {
                  const dueDate = a.due_at ? new Date(a.due_at) : null;
                  const formattedDate = dueDate
                    ? dueDate.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "No due date";

                  return (
                    <GlassCard key={a.id} className="hover-scale p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                          <AssignmentDescriptionLink assignmentId={a.id} className="mt-1" />

                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formattedDate}
                            </span>
                            {a.points_possible != null && (
                              <span className="glass-inset rounded-full px-2 py-0.5">
                                {a.points_possible} pts
                              </span>
                            )}
                          </div>
                        </div>

                        {a.html_url && (
                          <a
                            href={a.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="glass-inset inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-1.5 text-xs text-foreground transition-transform active:scale-95"
                          >
                            Open
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </GlassCard>
                  );
                })}
              </div>
            );
          })()}
        </section>
      )}

      {/* Section 2: Graded Assignments */}
      {(activeTab === "all" || activeTab === "graded") && (
        <section className="space-y-3">
          <h2 className="px-1 text-xs uppercase tracking-widest text-muted-foreground">Graded</h2>
          {gradedAssignments.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="h-5 w-5" />}
              message="No graded assignments recorded yet."
            />
          ) : (
            <div className="space-y-2.5">
              {gradedAssignments.map((a) => {
                const earned = a.submission?.score;
                const possible = a.points_possible;
                const pct =
                  earned != null && possible && possible > 0
                    ? Math.round((earned / possible) * 100)
                    : null;
                const itemColor = getGradeColor(pct);

                return (
                  <GlassCard key={a.id} className="hover-scale p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                        </div>
                        <AssignmentDescriptionLink assignmentId={a.id} className="mt-1" />

                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {a.submission?.submitted_at && (
                            <span>
                              Submitted{" "}
                              {new Date(a.submission.submitted_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                          {a.submission?.grade && (
                            <span className="glass-inset rounded-full px-2 py-0.5">
                              Mark: {a.submission.grade}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-medium tabular-nums text-foreground">
                            {earned != null ? earned : "—"}
                            {possible != null ? ` / ${possible}` : ""}
                          </p>
                          {pct != null && (
                            <span
                              className="mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                              style={{ color: itemColor, background: getGradeBg(pct) }}
                            >
                              {pct}%
                            </span>
                          )}
                        </div>
                        {a.html_url && (
                          <a
                            href={a.html_url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open in Canvas"
                            className="glass-inset rounded-xl p-2 text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Section 3: Announcements */}
      {(activeTab === "all" || activeTab === "announcements") && (
        <section className="space-y-3">
          <h2 className="px-1 text-xs uppercase tracking-widest text-muted-foreground">
            Announcements
          </h2>
          {(() => {
            const shown = showAllAnnouncements ? courseAnnouncements : announcementsWithinWindow;
            const hiddenCount = courseAnnouncements.length - announcementsWithinWindow.length;
            if (courseAnnouncements.length === 0) {
              return <EmptyState message="No announcements posted for this course." />;
            }
            return (
              <div className="space-y-2.5">
                {!showAllAnnouncements && hiddenCount > 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Only showing from the past 3 weeks ·{" "}
                    <button
                      type="button"
                      onClick={() => setShowAllAnnouncements(true)}
                      className="font-medium text-foreground/80 underline decoration-foreground/30 underline-offset-2 transition-colors hover:text-foreground"
                    >
                      View all
                    </button>
                  </p>
                )}
                {showAllAnnouncements && hiddenCount > 0 && (
                  <p className="px-1 text-[11px] text-muted-foreground">
                    Showing all {courseAnnouncements.length} ·{" "}
                    <button
                      type="button"
                      onClick={() => setShowAllAnnouncements(false)}
                      className="font-medium text-foreground/80 underline decoration-foreground/30 underline-offset-2 transition-colors hover:text-foreground"
                    >
                      Show less
                    </button>
                  </p>
                )}
                {shown.map((item) => {
                  const postedDate = new Date(item.posted_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });

                  const cleanBody = item.message
                    ? item.message
                        .replace(/<[^>]*>/g, " ")
                        .replace(/\s+/g, " ")
                        .trim()
                    : "";

                  return (
                    <GlassCard key={item.id} className="p-4">
                      <div className="mb-1.5 flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{postedDate}</span>
                      </div>

                      {cleanBody && (
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                          {cleanBody}
                        </p>
                      )}
                      {item.html_url && (
                        <a
                          href={item.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="story-link mt-2.5 inline-flex items-center gap-1 text-xs text-foreground"
                        >
                          Read full announcement on Canvas
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </GlassCard>
                  );
                })}
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}
