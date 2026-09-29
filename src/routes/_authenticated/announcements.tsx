import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Clock3, Megaphone, RotateCcw, X } from "lucide-react";
import { GlassCard, ErrorState, EmptyState } from "@/components/glass-card";
import { SkeletonBlock } from "@/components/skeletons/dashboard-skeletons";
import { announcementsQueryOptions as announcementsQO } from "@/lib/canvas.queries";
import { displayCourseName } from "@/lib/course-display";
import { useCourseHighlight } from "@/lib/course-highlight";
import { htmlToText } from "@/lib/html-text";
import { useLocalSet, DISMISSED_ANNOUNCEMENTS_KEY } from "@/lib/local-state";
import { useAnnouncementWindow, withinAnnouncementWindow } from "@/lib/announcement-window";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — CanvasPro" },
      {
        name: "description",
        content: "Recent announcements from all of your Canvas courses, in one timeline.",
      },
    ],
  }),
  validateSearch: (search: { course?: unknown; expand?: unknown }) => ({
    ...(typeof search?.course === "string" ? { course: search.course } : {}),
    ...(typeof search?.expand === "string" ? { expand: search.expand } : {}),
  }),
  loader: ({ context }) => {
    if (context?.queryClient) void context.queryClient.ensureQueryData(announcementsQO);
  },
  component: AnnouncementsPage,
});

function formatPosted(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

function AnnouncementsPage() {
  const { data, isLoading, isError, error } = useQuery(announcementsQO);
  const dismissed = useLocalSet(DISMISSED_ANNOUNCEMENTS_KEY);
  const highlight = useCourseHighlight();
  const search = useSearch({ strict: false }) as { course?: string; expand?: string };
  const announcementWindow = useAnnouncementWindow();
  const [courseFilter, setCourseFilter] = useState<number | "all">("all");
  const [expandedBody, setExpandedBody] = useState<Set<number>>(new Set());

  const visible = useMemo(
    () =>
      (data ?? [])
        .filter(
          (item) =>
            !dismissed.has(item.id) &&
            withinAnnouncementWindow(item.posted_at, announcementWindow.weeks),
        )
        .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime()),
    [data, dismissed, announcementWindow.weeks],
  );

  const courses = useMemo(() => {
    const map = new Map<number, { id: number; label: string; count: number }>();
    visible.forEach((item) => {
      const current = map.get(item.course_id);
      if (current) current.count += 1;
      else
        map.set(item.course_id, {
          id: item.course_id,
          label: displayCourseName(item.course_name, item.course_code),
          count: 1,
        });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [visible]);

  const feed =
    courseFilter === "all" ? visible : visible.filter((item) => item.course_id === courseFilter);

  useEffect(() => {
    if (!search.expand || !data) return;
    const id = Number(search.expand);
    const item = visible.find((announcement) => announcement.id === id);
    if (!item) return;
    setCourseFilter(item.course_id);
    setExpandedBody((previous) => new Set(previous).add(id));
    const timer = window.setTimeout(
      () =>
        document
          .getElementById(`announcement-${id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      180,
    );
    return () => window.clearTimeout(timer);
  }, [data, search.expand, visible]);

  const toggleBody = (id: number) =>
    setExpandedBody((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="glass-panel-strong relative isolate overflow-hidden rounded-[2rem] border border-primary/15 p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Campus feed · {announcementWindow.label}
            </p>
            <h1 className="mt-2 text-4xl font-medium tracking-[-0.045em] sm:text-5xl">
              What changed while you were away.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Every course update, ordered by when it happened—not hidden behind class cards.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-72">
            <div className="rounded-2xl border border-foreground/10 bg-background/35 p-4 backdrop-blur-md">
              <p className="text-3xl font-medium tabular-nums tracking-[-0.05em]">
                {visible.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Recent posts</p>
            </div>
            <div className="rounded-2xl border border-foreground/10 bg-background/35 p-4 backdrop-blur-md">
              <p className="text-3xl font-medium tabular-nums tracking-[-0.05em]">
                {courses.length}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Active courses</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setCourseFilter("all")}
          className={cn(
            "press shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
            courseFilter === "all"
              ? "border-primary/30 bg-primary/15 text-foreground"
              : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
          )}
        >
          All updates <span className="ml-1 opacity-60">{visible.length}</span>
        </button>
        {courses.map((course) => (
          <button
            key={course.id}
            type="button"
            onClick={() => setCourseFilter(course.id)}
            className={cn(
              "press shrink-0 rounded-full border px-4 py-2 text-xs font-medium transition-colors",
              courseFilter === course.id
                ? "border-primary/30 bg-primary/15 text-foreground"
                : "border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:text-foreground",
            )}
          >
            {course.label} <span className="ml-1 opacity-60">{course.count}</span>
          </button>
        ))}
        {dismissed.size > 0 && (
          <button
            type="button"
            onClick={() => (data ?? []).forEach((item) => dismissed.remove(item.id))}
            className="press ml-auto inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restore {dismissed.size}
          </button>
        )}
      </div>

      {isLoading && (
        <div className="glass-panel overflow-hidden rounded-[1.75rem]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="grid gap-3 border-b border-foreground/10 p-5 last:border-0 sm:grid-cols-[7rem_1fr]"
            >
              <SkeletonBlock className="h-4 w-20" />
              <div className="space-y-3">
                <SkeletonBlock className="h-5 w-3/5" />
                <SkeletonBlock className="h-12 w-full" />
              </div>
            </div>
          ))}
        </div>
      )}
      {isError && (
        <GlassCard>
          <ErrorState message={(error as Error).message} />
        </GlassCard>
      )}
      {!isLoading && !isError && feed.length === 0 && (
        <GlassCard>
          <EmptyState message="No announcements in this view." />
        </GlassCard>
      )}

      {!isLoading && !isError && feed.length > 0 && (
        <section className="glass-panel overflow-hidden rounded-[1.75rem] border border-foreground/10">
          {feed.map((item, index) => {
            const body = htmlToText(item.message);
            const bodyOpen = expandedBody.has(item.id);
            const posted = formatPosted(item.posted_at);
            const label = displayCourseName(item.course_name, item.course_code);
            const highlightProps = highlight(label);
            const firstForCourse =
              feed.find((entry) => entry.course_id === item.course_id)?.id === item.id;
            return (
              <article
                key={item.id}
                id={
                  item.id === Number(search.expand)
                    ? `announcement-${item.id}`
                    : firstForCourse
                      ? highlightProps.id
                      : undefined
                }
                className={cn(
                  "group relative grid gap-4 border-b border-foreground/10 p-5 transition-colors last:border-0 hover:bg-foreground/[0.025] sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:p-6",
                  highlightProps.className,
                )}
              >
                <div>
                  <p className="text-sm font-medium tabular-nums">{posted.date}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3" /> {posted.time}
                  </p>
                </div>
                <div className="min-w-0">
                  <Link
                    to="/courses/$courseId"
                    params={{ courseId: String(item.course_id) }}
                    className="inline-flex max-w-full items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary hover:opacity-80"
                  >
                    <span className="truncate">{label}</span>
                    <ArrowUpRight className="h-3 w-3 shrink-0" />
                  </Link>
                  <h2 className="mt-2 text-balance text-lg font-semibold tracking-[-0.02em] sm:text-xl">
                    {item.title}
                  </h2>
                  <p
                    className={cn(
                      "mt-2 whitespace-pre-line break-words text-sm leading-6 text-muted-foreground",
                      !bodyOpen && "line-clamp-3",
                    )}
                  >
                    {body}
                  </p>
                  {body.length > 180 && (
                    <button
                      type="button"
                      onClick={() => toggleBody(item.id)}
                      className="mt-3 text-xs font-medium text-foreground underline decoration-foreground/25 underline-offset-4"
                    >
                      {bodyOpen ? "Show less" : "Read full update"}
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismissed.add(item.id)}
                  aria-label={`Dismiss ${item.title}`}
                  className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground opacity-70 transition hover:bg-foreground/10 hover:text-foreground sm:static sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
                {index === 0 && (
                  <span className="absolute left-0 top-6 h-10 w-0.5 rounded-full bg-primary" />
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
