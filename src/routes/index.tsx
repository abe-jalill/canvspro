import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import {
  getCoursesFn,
  getAllAssignmentsFn,
  getAnnouncementsFn,
} from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { displayCourseName, displayCourseCode } from "@/lib/course-display";
import {
  useLocalSet,
  DISMISSED_ANNOUNCEMENTS_KEY,
  COMPLETED_ASSIGNMENTS_KEY,
} from "@/lib/local-state";
import { Check, X } from "lucide-react";

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
        content: "Your classes, grades, upcoming assignments, and announcements.",
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

function formatDue(due: string | null) {
  if (!due) return "No due date";
  const d = new Date(due);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function CoursesWidget() {
  const { data, isLoading, isError, error } = useQuery(coursesQO);

  return (
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
              className="glass-inset glass-hover flex items-center justify-between p-3"
            >
              <div className="min-w-0 pr-3">
                <p className="truncate text-sm font-medium">
                  {displayCourseName(c.name, c.course_code)}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {c.course_code}
                </p>
              </div>
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                {formatScore(c.current_score, c.current_grade)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

function UpcomingWidget() {
  const { data, isLoading, isError, error } = useQuery(assignmentsQO);
  const completed = useLocalSet(COMPLETED_ASSIGNMENTS_KEY);

  const upcoming = (data ?? [])
    .filter((a) => {
      if (!a.due_at) return false;
      const due = new Date(a.due_at).getTime();
      const now = Date.now();
      const week = now + 7 * 24 * 60 * 60 * 1000;
      return due >= now && due <= week;
    })
    .sort((a, b) => {
      const ac = completed.has(a.id) ? 1 : 0;
      const bc = completed.has(b.id) ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return (
        new Date(a.due_at as string).getTime() -
        new Date(b.due_at as string).getTime()
      );
    });

  // Group by course
  type Item = (typeof upcoming)[number];
  const groups = new Map<
    number,
    { name: string; code: string; items: Item[] }
  >();
  upcoming.forEach((a) => {
    const g = groups.get(a.course_id) ?? {
      name: a.course_name,
      code: a.course_code ?? "",
      items: [],
    };
    g.items.push(a);
    groups.set(a.course_id, g);
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
      {data && upcoming.length === 0 && (
        <EmptyState message="Nothing due this week." />
      )}
      {groups.size > 0 && (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([id, g]) => (
            <div key={id}>
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
              <ul className="space-y-2">
                {g.items.map((a) => {
                  const done = completed.has(a.id);
                  return (
                    <li
                      key={a.id}
                      className={cnDone(
                        "glass-inset glass-hover flex items-center justify-between gap-3 p-3",
                        done,
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <CompleteButton
                          done={done}
                          onClick={() => completed.toggle(a.id)}
                          label={a.name}
                        />
                        <p
                          className={
                            "min-w-0 truncate text-sm font-medium " +
                            (done ? "text-muted-foreground line-through" : "")
                          }
                        >
                          {a.name}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">
                        {formatDue(a.due_at)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function AnnouncementsWidget() {
  const { data, isLoading, isError, error } = useQuery(announcementsQO);
  const dismissed = useLocalSet(DISMISSED_ANNOUNCEMENTS_KEY);

  const items = (data ?? []).filter((a) => !dismissed.has(a.id)).slice(0, 12);

  // Group by course
  type Item = (typeof items)[number];
  const groups = new Map<
    number,
    { name: string; code: string; items: Item[] }
  >();
  items.forEach((a) => {
    const g = groups.get(a.course_id) ?? {
      name: a.course_name,
      code: a.course_code ?? "",
      items: [],
    };
    g.items.push(a);
    groups.set(a.course_id, g);
  });

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
      {data && items.length === 0 && (
        <EmptyState message="No announcements to show." />
      )}
      {groups.size > 0 && (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([id, g]) => (
            <div key={id}>
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
              <ul className="space-y-2">
                {g.items.map((a) => (
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
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function cnDone(base: string, done: boolean) {
  return done ? base + " opacity-60" : base;
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
