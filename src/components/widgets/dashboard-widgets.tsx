import { Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
  type AssignmentItem,
  type CourseSummary,
} from "@/lib/canvas.functions";
import {
  GlassCard,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components/glass-card";
import { cn } from "@/lib/utils";
import { htmlToText } from "@/lib/html-text";
import type { WidgetId } from "@/lib/dashboard-layout";
import { displayCourseName } from "@/lib/course-display";
import {
  useLocalSet,
  DISMISSED_ANNOUNCEMENTS_KEY,
  COMPLETED_ASSIGNMENTS_KEY,
} from "@/lib/local-state";
import { Check, X, CalendarPlus, FileText, ChevronDown } from "lucide-react";
import {
  getCountdown,
  urgencyTextClass,
  urgencyAccentClass,
} from "@/lib/countdown";
import { buildIcs, downloadIcs, safeFilename } from "@/lib/ics";
import { SyllabusModal } from "@/components/syllabus-modal";
import { DigestCard } from "@/components/digest-card";
import { WorkloadHeatmap } from "@/components/workload-heatmap";
import { GpaCalculator } from "@/components/gpa-calculator";
import { getCalendarEventsFn } from "@/lib/canvas.functions";
import { Lock } from "lucide-react";

const coursesQO = queryOptions({
  queryKey: ["canvas", "courses"],
  queryFn: () => getCoursesFn(),
  staleTime: 5 * 60_000,
});

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

const announcementsQO = queryOptions({
  queryKey: ["canvas", "announcements"],
  queryFn: () => getAnnouncementsFn(),
  staleTime: 5 * 60_000,
});

function formatScore(score: number | null, grade: string | null) {
  if (score == null && !grade) return "—";
  const parts: string[] = [];
  if (score != null) parts.push(`${score.toFixed(1)}%`);
  if (grade) parts.push(grade);
  return parts.join(" · ");
}

function stripHtml(html: string) {
  return htmlToText(html);
}

function DigestWidget() {
  const courses = useQuery(coursesQO);
  const assignments = useQuery(assignmentsQO);
  const announcements = useQuery(announcementsQO);
  if (!courses.data || !assignments.data || !announcements.data) return null;
  return (
    <DigestCard
      courses={courses.data}
      assignments={assignments.data}
      announcements={announcements.data}
    />
  );
}

function CoursesWidget() {
  const { data, isLoading, isError, error } = useQuery(coursesQO);
  const [syllabus, setSyllabus] = useState<CourseSummary | null>(null);

  return (
    <>
      <GlassCard title="Classes & Grades" subtitle="Active enrollments">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-inset p-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
            ))}
          </div>
        )}
        {isError && <ErrorState message={(error as Error).message} />}
        {data && data.length === 0 && (
          <EmptyState message="No active courses." />
        )}
        {data && data.length > 0 && (
          <ul className="space-y-2">
            {data.map((c) => (
              <li
                key={c.id}
                className="glass-inset glass-hover flex items-center justify-between gap-2 p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {displayCourseName(c.name, c.course_code)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">

                  {c.syllabus_body && (
                    <button
                      onClick={() => setSyllabus(c)}
                      aria-label={`Open ${displayCourseName(
                        c.name,
                        c.course_code,
                      )} syllabus`}
                      title="Syllabus"
                      className="flex h-7 items-center gap-1 rounded-lg border border-glass-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <FileText className="h-3 w-3" />
                      Syllabus
                    </button>
                  )}
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                    {formatScore(c.current_score, c.current_grade)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
      {syllabus && syllabus.syllabus_body && (
        <SyllabusModal
          title={displayCourseName(syllabus.name, syllabus.course_code)}
          html={syllabus.syllabus_body}
          onClose={() => setSyllabus(null)}
        />
      )}
    </>
  );
}

function UpcomingWidget() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  const courses = useQuery(coursesQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);
  const [expanded, setExpanded] = useState<number[]>([]);


  const inWindow = (data ?? []).filter((a) => {
    if (!a.due_at) return false;
    const due = new Date(a.due_at).getTime();
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    return due >= now && due <= week;
  });

  // Group by course, keyed by course_id. We show one section per active
  // course (even if empty) so the widget makes per-class expectations clear.
  type Group = {
    id: number;
    name: string;
    code: string;
    items: AssignmentItem[];
  };
  const groupMap = new Map<number, Group>();
  (courses.data ?? []).forEach((c) => {
    groupMap.set(c.id, {
      id: c.id,
      name: c.name,
      code: c.course_code ?? "",
      items: [],
    });
  });
  inWindow.forEach((a) => {
    const g = groupMap.get(a.course_id) ?? {
      id: a.course_id,
      name: a.course_name,
      code: a.course_code ?? "",
      items: [],
    };
    g.items.push(a);
    groupMap.set(a.course_id, g);
  });
  const groups = Array.from(groupMap.values()).sort((a, b) =>
    displayCourseName(a.name, a.code).localeCompare(
      displayCourseName(b.name, b.code),
    ),
  );
  // Sort each group's items: incomplete first, then by due date.
  groups.forEach((g) => {
    g.items.sort((a, b) => {
      const ac = completed.has(a.id) ? 1 : 0;
      const bc = completed.has(b.id) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return (
        new Date(a.due_at as string).getTime() -
        new Date(b.due_at as string).getTime()
      );
    });
  });

  return (
    <GlassCard
      title="Upcoming Assignments"
      subtitle="Due within the next 7 days"
      action={
        <Link
          to="/assignments"

          className="glass-hover rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground"
        >
          View all
        </Link>
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-inset p-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/2" />
            </div>
          ))}
        </div>
      )}
      {isError && <ErrorState message={(error as Error).message} />}
      {data && groups.length === 0 && (
        <EmptyState message="No active courses." />
      )}
      {groups.length > 0 && (
        <div className="divide-y divide-foreground/10">
          {groups.map((g) => {
            const isOpen = expanded.includes(g.id);
            return (
              <div key={g.id} className="py-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) =>
                      prev.includes(g.id)
                        ? prev.filter((x) => x !== g.id)
                        : [...prev, g.id],
                    )
                  }
                  aria-expanded={isOpen}
                  className="glass-hover flex min-h-11 w-full items-center gap-3 rounded-xl px-1.5 text-left"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                  <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                    {displayCourseName(g.name, g.code)}
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {g.items.length}
                  </span>
                </button>
                {isOpen && g.items.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {g.items.map((a) => {
                      const done = completed.has(a.id);
                      const cd = getCountdown(a.due_at, { completed: done });
                      return (
                        <li
                          key={a.id}
                          className={cn(
                            "glass-inset glass-hover flex items-center justify-between gap-2 p-3",
                            cd && urgencyAccentClass(cd.urgency),
                            done && "opacity-60",
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                            <CompleteButton
                              done={done}
                              onClick={() => completed.toggle(a.id)}
                              label={a.name}
                            />
                            <p
                              className={cn(
                                "min-w-0 flex-1 truncate text-sm font-medium",
                                done && "text-muted-foreground line-through",
                              )}
                            >
                              {a.name}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div className="text-right">
                              <p
                                className={cn(
                                  "whitespace-nowrap text-xs tabular-nums sm:text-sm",
                                  cd
                                    ? urgencyTextClass(cd.urgency)
                                    : "text-muted-foreground",
                                )}
                              >
                                {cd ? cd.label : "—"}
                              </p>
                              {cd && (
                                <p className="mt-0.5 hidden whitespace-nowrap text-[10px] tabular-nums text-muted-foreground/80 sm:block">
                                  {cd.fullDate}
                                </p>
                              )}
                            </div>
                            <IcsButton assignment={a} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {isOpen && g.items.length === 0 && (
                  <p className="px-2 py-3 text-xs text-muted-foreground/80">
                    No upcoming assignments
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

    </GlassCard>
  );
}

function AnnouncementsWidget() {
  const { data, isLoading, isError, error } = useQuery(announcementsQO);
  const dismissed = useLocalSet(DISMISSED_ANNOUNCEMENTS_KEY);
  const [expanded, setExpanded] = useState<number[]>([]);

  const visible = (data ?? []).filter((a) => !dismissed.has(a.id));

  type Item = (typeof visible)[number];
  type Group = { id: number; name: string; code: string; items: Item[] };
  const groupMap = new Map<number, Group>();
  visible.forEach((a) => {
    const g = groupMap.get(a.course_id) ?? {
      id: a.course_id,
      name: a.course_name,
      code: a.course_code ?? "",
      items: [],
    };
    g.items.push(a);
    groupMap.set(a.course_id, g);
  });
  const groups = Array.from(groupMap.values())
    .filter((group) => group.items.length > 0)
    .sort((a, b) =>
      displayCourseName(a.name, a.code).localeCompare(
        displayCourseName(b.name, b.code),
      ),
    );

  return (
    <GlassCard
      title="Announcements"
      subtitle="Latest from your courses"
      action={
        <Link
          to="/announcements"

          className="glass-hover rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground"
        >
          View all
        </Link>
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-inset p-4">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      )}
      {isError && <ErrorState message={(error as Error).message} />}
      {data && groups.length === 0 && (
        <EmptyState message="No new announcements." />
      )}
      {groups.length > 0 && (
        <div className="divide-y divide-foreground/10">
          {groups.map((g) => {
            const isOpen = expanded.includes(g.id);
            return (
              <div key={g.id} className="py-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpanded((prev) =>
                      prev.includes(g.id)
                        ? prev.filter((id) => id !== g.id)
                        : [...prev, g.id],
                    )
                  }
                  aria-expanded={isOpen}
                  className="glass-hover flex min-h-11 w-full items-center gap-3 rounded-xl px-1.5 text-left"
                >
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                      isOpen && "rotate-180",
                    )}
                  />
                  <h3 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                    {displayCourseName(g.name, g.code)}
                  </h3>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {g.items.length}
                  </span>
                </button>
                {isOpen && (
                  <ul className="mt-2 space-y-2">
                    {g.items.slice(0, 4).map((a) => (
                      <li key={a.id} className="glass-inset glass-hover p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 flex-1 text-sm font-semibold">
                            {a.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="hidden whitespace-nowrap text-xs text-muted-foreground sm:inline">
                              {new Date(a.posted_at).toLocaleDateString()}
                            </span>
                            <DismissButton
                              onClick={() => dismissed.add(a.id)}
                              label={a.title}
                            />
                          </div>
                        </div>
                        <p className="mt-1 line-clamp-2 break-words text-xs text-muted-foreground">
                          {stripHtml(a.message)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}

function CompleteButton({
  done,
  onClick,
  label,
}: {
  done: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={done ? `Mark ${label} incomplete` : `Mark ${label} complete`}
      aria-pressed={done}
      className={
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors " +
        (done
          ? "border-foreground/60 bg-foreground/80 text-background"
          : "border-foreground/30 bg-transparent text-transparent hover:border-foreground/60 hover:text-foreground/60")
      }
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </button>
  );
}

function DismissButton({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`Dismiss ${label}`}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-foreground/20 text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

function IcsButton({ assignment }: { assignment: AssignmentItem }) {
  const onClick = () => {
    if (!assignment.due_at) return;
    const ics = buildIcs({
      uid: `canvas-assignment-${assignment.id}@lovable`,
      title: `${assignment.name} (${displayCourseName(
        assignment.course_name,
        assignment.course_code,
      )})`,
      description: "Assignment due on Canvas.",
      url: assignment.html_url,
      start: new Date(assignment.due_at),
    });
    downloadIcs(`${safeFilename(assignment.name)}.ics`, ics);
  };
  return (
    <button
      onClick={onClick}
      aria-label={`Add ${assignment.name} to calendar`}
      title="Add to calendar (.ics)"
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-foreground/20 text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
    >
      <CalendarPlus className="h-3.5 w-3.5" />
    </button>
  );
}


function FocusWidget() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const soon = (data ?? [])
    .filter((a) => {
      if (!a.due_at || completed.has(a.id)) return false;
      const due = new Date(a.due_at).getTime();
      const now = Date.now();
      return due >= now && due <= now + 48 * 60 * 60 * 1000;
    })
    .sort(
      (a, b) =>
        new Date(a.due_at as string).getTime() -
        new Date(b.due_at as string).getTime(),
    );

  return (
    <GlassCard
      title="Focus"
      subtitle="Due within 48 hours"
      action={
        <Link
          to="/focus"
          className="glass-hover rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground"
        >
          Open
        </Link>
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-inset p-3">
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}
      {isError && <ErrorState message={(error as Error).message} />}
      {data && soon.length === 0 && (
        <EmptyState message="Nothing due in the next 48 hours." />
      )}
      {soon.length > 0 && (
        <ul className="space-y-2">
          {soon.map((a) => {
            const cd = getCountdown(a.due_at, { completed: false });
            return (
              <li
                key={a.id}
                className={cn(
                  "glass-inset glass-hover flex items-center justify-between gap-3 p-3",
                  cd && urgencyAccentClass(cd.urgency),
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {displayCourseName(a.course_name, a.course_code)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap text-sm tabular-nums",
                    cd ? urgencyTextClass(cd.urgency) : "text-muted-foreground",
                  )}
                >
                  {cd ? cd.label : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}

function CalendarWidget() {
  const { data, isLoading, isError, error } = useQuery(eventsQO);

  const upcoming = (data ?? [])
    .filter((e) => {
      if (!e.start_at) return false;
      const t = new Date(e.start_at).getTime();
      const now = Date.now();
      return t >= now && t <= now + 7 * 24 * 60 * 60 * 1000;
    })
    .sort(
      (a, b) =>
        new Date(a.start_at as string).getTime() -
        new Date(b.start_at as string).getTime(),
    )
    .slice(0, 8);

  return (
    <GlassCard
      title="Calendar"
      subtitle="Next 7 days"
      action={
        <Link
          to="/schedule"
          className="glass-hover rounded-lg px-2.5 py-1 text-xs font-medium text-muted-foreground"
        >
          View all
        </Link>
      }
    >
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-inset p-3">
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      )}
      {isError && <ErrorState message={(error as Error).message} />}
      {data && upcoming.length === 0 && (
        <EmptyState message="No calendar events this week." />
      )}
      {upcoming.length > 0 && (
        <ul className="space-y-2">
          {upcoming.map((e) => (
            <li
              key={String(e.id)}
              className="glass-inset glass-hover flex items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.title}</p>
                {e.context_name && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.context_name}
                  </p>
                )}
              </div>
              <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                {new Date(e.start_at as string).toLocaleString(undefined, {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function HeatmapWidget() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  return (
    <GlassCard title="Workload" subtitle="Assignment density by week">
      {isLoading && <Skeleton className="h-24 w-full" />}
      {isError && <ErrorState message={(error as Error).message} />}
      {data && <WorkloadHeatmap assignments={data} />}
    </GlassCard>
  );
}

function GpaWidget() {
  return <GpaCalculator />;
}

/** Shown in place of a Pro-only widget for free-tier accounts. */
export function LockedWidget({
  title,
  feature,
}: {
  title: string;
  feature: string;
}) {
  return (
    <GlassCard title={title} subtitle="Canvas Pro">
      <div className="flex flex-col items-start gap-3 p-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Lock className="h-4 w-4" />
          <p className="text-sm">{feature} is part of Canvas Pro.</p>
        </div>
        <Link
          to="/billing"
          className="glass-hover inline-flex min-h-10 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
        >
          Upgrade — $2.99/month
        </Link>
      </div>
    </GlassCard>
  );
}

export interface WidgetMeta {
  label: string;
  wide?: boolean;
  pro?: boolean;
  render: () => ReactElement;
}

export const WIDGETS: Record<WidgetId, WidgetMeta> = {
  digest: { label: "Since your last visit", wide: true, render: () => <DigestWidget /> },
  focus: { label: "Focus", pro: true, render: () => <FocusWidget /> },
  classes: { label: "Classes & Grades", render: () => <CoursesWidget /> },
  gpa: { label: "GPA", render: () => <GpaWidget /> },
  upcoming: { label: "Upcoming Assignments", wide: true, render: () => <UpcomingWidget /> },
  announcements: { label: "Announcements", wide: true, render: () => <AnnouncementsWidget /> },
  calendar: { label: "Calendar", pro: true, render: () => <CalendarWidget /> },
  heatmap: { label: "Workload heatmap", pro: true, wide: true, render: () => <HeatmapWidget /> },
};
