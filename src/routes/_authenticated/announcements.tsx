import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getAnnouncementsFn, type AnnouncementItem } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, DISMISSED_ANNOUNCEMENTS_KEY } from "@/lib/local-state";
import { X, RotateCcw, ChevronDown } from "lucide-react";
import { htmlToText } from "@/lib/html-text";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useCourseHighlight } from "@/lib/course-highlight";
import {
  useAnnouncementWindow,
  withinAnnouncementWindow,
} from "@/lib/announcement-window";

const announcementsQO = queryOptions({
  queryKey: ["canvas", "announcements"],
  queryFn: () => getAnnouncementsFn(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Canvas Pro" },
      {
        name: "description",
        content: "Recent announcements from all of your Canvas courses, grouped by class.",
      },
      { property: "og:title", content: "Announcements — Canvas Pro" },
      {
        property: "og:description",
        content: "Recent announcements from all of your Canvas courses, grouped by class.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: { course?: unknown; expand?: unknown }) => ({
    ...(typeof search?.course === "string" ? { course: search.course } : {}),
    ...(typeof search?.expand === "string" ? { expand: search.expand } : {}),
  }),
  component: AnnouncementsPage,
});

function stripHtml(html: string) {
  return htmlToText(html);
}

function AnnouncementsPage() {
  const { data, isLoading, isError, error } = useQuery(announcementsQO);
  const dismissed = useLocalSet(DISMISSED_ANNOUNCEMENTS_KEY);
  const highlight = useCourseHighlight();
  const search = useSearch({ strict: false }) as {
    course?: string;
    expand?: string;
  };
  const [expanded, setExpanded] = useState<number[]>([]);
  const [expandedBody, setExpandedBody] = useState<Set<number>>(new Set());

  const announcementWindow = useAnnouncementWindow();

  const visible = useMemo(
    () =>
      (data ?? []).filter(
        (a) =>
          !dismissed.has(a.id) &&
          withinAnnouncementWindow(a.posted_at, announcementWindow.weeks),
      ),
    [data, dismissed, announcementWindow.weeks],
  );

  type Group = {
    id: number;
    name: string;
    code: string;
    items: AnnouncementItem[];
  };
  const groups = useMemo(() => {
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
    return Array.from(groupMap.values()).sort((a, b) =>
      displayCourseName(a.name, a.code).localeCompare(displayCourseName(b.name, b.code)),
    );
  }, [visible]);

  useEffect(() => {
    if (!data || !search.expand) return;
    const id = Number(search.expand);
    if (!id) return;
    const group = groups.find((g) => g.items.some((a) => a.id === id));
    if (!group) return;
    setExpanded((prev) => (prev.includes(group.id) ? prev : [...prev, group.id]));
    setExpandedBody((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const timer = window.setTimeout(() => {
      document
        .getElementById(`announcement-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [data, search.expand, groups]);

  const toggleBody = (id: number) => {
    setExpandedBody((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Last 30 days
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Announcements</h1>
        </div>
        {dismissed.size > 0 && (
          <button
            onClick={() => {
              (data ?? []).forEach((a) => dismissed.remove(a.id));
            }}
            className="glass-hover inline-flex items-center gap-1.5 rounded-lg border border-glass-border px-3 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore dismissed ({dismissed.size})
          </button>
        )}
      </header>

      {isLoading && (
        <GlassCard>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </GlassCard>
      )}
      {isError && (
        <GlassCard>
          <ErrorState message={(error as Error).message} />
        </GlassCard>
      )}
      {!isLoading && !isError && groups.length === 0 && (
        <GlassCard>
          <EmptyState message="No announcements in the last 30 days." />
        </GlassCard>
      )}

      <div className="space-y-3">
        {groups.map((g) => {
          const open = expanded.includes(g.id);
          const label = displayCourseName(g.name, g.code);
          const latest = g.items.reduce(
            (max, a) => Math.max(max, new Date(a.posted_at).getTime()),
            0,
          );
          return (
            <div key={g.id} {...highlight(label)}>
              <GlassCard className="p-0 sm:p-0 md:p-0">
                <button
                  onClick={() =>
                    setExpanded((prev) =>
                      prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id],
                    )
                  }
                  aria-expanded={open}
                  className="glass-hover grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left sm:p-6"
                >
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold tracking-tight sm:text-lg">
                      {label}
                    </h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {g.items.length} announcement
                        {g.items.length === 1 ? "" : "s"}
                      </span>
                      {latest > 0 && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>
                            latest{" "}
                            {new Date(latest).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-semibold tabular-nums tracking-tight">
                        {g.items.length}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Posts
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-glass-border p-4 sm:p-6">
                    <div className="space-y-3">
                      {g.items.map((a) => {
                        const bodyOpen = expandedBody.has(a.id);
                        const bodyText = stripHtml(a.message);
                        return (
                          <div
                            key={a.id}
                            id={`announcement-${a.id}`}
                            className="glass-inset glass-hover p-3 sm:p-4"
                          >
                            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:gap-3">
                              <h3 className="min-w-0 text-sm font-semibold tracking-tight">
                                {a.title}
                              </h3>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="whitespace-nowrap text-[11px] text-muted-foreground sm:text-xs">
                                  {new Date(a.posted_at).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                                <button
                                  onClick={() => dismissed.add(a.id)}
                                  aria-label={`Dismiss ${a.title}`}
                                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/20 text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <p
                              className={cn(
                                "mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground",
                                !bodyOpen && "line-clamp-6",
                              )}
                            >
                              {bodyText}
                            </p>
                            {bodyText.length > 200 && (
                              <button
                                type="button"
                                onClick={() => toggleBody(a.id)}
                                className="mt-2 text-xs font-medium text-foreground/80 underline decoration-foreground/30 underline-offset-2 transition-colors hover:text-foreground"
                              >
                                {bodyOpen ? "See less" : "See more"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </GlassCard>
            </div>
          );
        })}
      </div>
    </div>
  );
}
