import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
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
import { displayCourseName, displayCourseCode } from "@/lib/course-display";
import {
  useLocalSet,
  DISMISSED_ANNOUNCEMENTS_KEY,
  COMPLETED_ASSIGNMENTS_KEY,
} from "@/lib/local-state";
import { Check, X, CalendarPlus, FileText } from "lucide-react";
import {
  getCountdown,
  urgencyTextClass,
  urgencyAccentClass,
} from "@/lib/countdown";
import { buildIcs, downloadIcs, safeFilename } from "@/lib/ics";
import { SyllabusModal } from "@/components/syllabus-modal";
import { DigestCard } from "@/components/digest-card";

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

const announcementsQO = queryOptions({
  queryKey: ["canvas", "announcements"],
  queryFn: () => getAnnouncementsFn(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Canvas Student" },
      {
        name: "description",
        content:
          "Your classes, grades, upcoming assignments, and announcements.",
      },
    ],
  }),
  component: Dashboard,
});

function formatScore(score: number | null, grade: string | null) {
  if (score == null && !grade) return "—";
  const parts: string[] = [];
  if (score != null) parts.push(`${score.toFixed(1)}%`);
  if (grade) parts.push(grade);
  return parts.join(" · ");
}

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function Dashboard() {
  return (
    <div className="space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Overview
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Dashboard
        </h1>
      </header>

      <DigestBridge />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1">
          <CoursesWidget />
        </div>
        <div className="md:col-span-2">
          <UpcomingWidget />
        </div>
      </div>

      <AnnouncementsWidget />
    </div>
  );
}

function DigestBridge() {
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
                <div className="min-w-0 pr-2">
                  <p className="truncate text-sm font-medium">
                    {displayCourseName(c.name, c.course_code)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {c.course_code}
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
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                  {displayCourseName(g.name, g.code)}
                </h3>
                <span className="truncate text-xs text-muted-foreground">
                  {displayCourseCode(g.name, g.code) === displayCourseName(g.name, g.code)
                    ? g.code
                    : g.name}
                </span>
              </div>
              {g.items.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground/80">
                  No upcoming assignments
                </p>
              ) : (
                <ul className="space-y-2">
                  {g.items.map((a) => {
                    const done = completed.has(a.id);
                    const cd = getCountdown(a.due_at, { completed: done });
                    return (
                      <li
                        key={a.id}
                        className={cn(
                          "glass-inset glass-hover flex items-center justify-between gap-3 p-3",
                          cd && urgencyAccentClass(cd.urgency),
                          done && "opacity-60",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <CompleteButton
                            done={done}
                            onClick={() => completed.toggle(a.id)}
                            label={a.name}
                          />
                          <p
                            className={cn(
                              "min-w-0 truncate text-sm font-medium",
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
                                "whitespace-nowrap text-sm tabular-nums",
                                cd
                                  ? urgencyTextClass(cd.urgency)
                                  : "text-muted-foreground",
                              )}
                            >
                              {cd ? cd.label : "—"}
                            </p>
                            {cd && (
                              <p className="mt-0.5 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground/80">
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
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function AnnouncementsWidget() {
  const { data, isLoading, isError, error } = useQuery(announcementsQO);
  const courses = useQuery(coursesQO);
  const dismissed = useLocalSet(DISMISSED_ANNOUNCEMENTS_KEY);

  const visible = (data ?? []).filter((a) => !dismissed.has(a.id));

  type Item = (typeof visible)[number];
  type Group = { id: number; name: string; code: string; items: Item[] };
  const groupMap = new Map<number, Group>();
  (courses.data ?? []).forEach((c) => {
    groupMap.set(c.id, {
      id: c.id,
      name: c.name,
      code: c.course_code ?? "",
      items: [],
    });
  });
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
  const groups = Array.from(groupMap.values()).sort((a, b) =>
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
        <EmptyState message="No active courses." />
      )}
      {groups.length > 0 && (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.id}>
              <div className="mb-2 flex items-baseline gap-2 px-1">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                  {displayCourseName(g.name, g.code)}
                </h3>
                <span className="truncate text-xs text-muted-foreground">
                  {displayCourseCode(g.name, g.code) === displayCourseName(g.name, g.code)
                    ? g.code
                    : g.name}
                </span>
              </div>
              {g.items.length === 0 ? (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground/80">
                  No new announcements
                </p>
              ) : (
                <ul className="space-y-2">
                  {g.items.slice(0, 4).map((a) => (
                    <li key={a.id} className="glass-inset glass-hover p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-semibold">
                          {a.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                            {new Date(a.posted_at).toLocaleDateString()}
                          </span>
                          <DismissButton
                            onClick={() => dismissed.add(a.id)}
                            label={a.title}
                          />
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {stripHtml(a.message)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
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
