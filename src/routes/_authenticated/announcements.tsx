import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import {
  getAnnouncementsFn,
  type AnnouncementItem,
} from "@/lib/canvas.functions";
import {
  GlassCard,
  Skeleton,
  ErrorState,
  EmptyState,
} from "@/components/glass-card";
import { displayCourseName } from "@/lib/course-display";
import { useLocalSet, DISMISSED_ANNOUNCEMENTS_KEY } from "@/lib/local-state";
import { X, RotateCcw } from "lucide-react";
import { htmlToText } from "@/lib/html-text";
import {
  useCourseHighlight,
  validateCourseSearch,
} from "@/lib/course-highlight";

const announcementsQO = queryOptions({
  queryKey: ["canvas", "announcements"],
  queryFn: () => getAnnouncementsFn(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Canvas Pro" },
      { name: "description", content: "Recent announcements from all of your Canvas courses, grouped by class." },
      { property: "og:title", content: "Announcements — Canvas Pro" },
      { property: "og:description", content: "Recent announcements from all of your Canvas courses, grouped by class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: validateCourseSearch,
  component: AnnouncementsPage,
});

function stripHtml(html: string) {
  return htmlToText(html);
}

function AnnouncementsPage() {
  const { data, isLoading, isError, error } = useQuery(announcementsQO);
  const dismissed = useLocalSet(DISMISSED_ANNOUNCEMENTS_KEY);
  const highlight = useCourseHighlight();

  const visible = (data ?? []).filter((a) => !dismissed.has(a.id));

  type Group = {
    id: number;
    name: string;
    code: string;
    items: AnnouncementItem[];
  };
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
  const groups = Array.from(groupMap.values()).sort((a, b) =>
    displayCourseName(a.name, a.code).localeCompare(
      displayCourseName(b.name, b.code),
    ),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Last 30 days
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
            Announcements
          </h1>
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

      {groups.length > 0 && (
        <GlassCard>
          <div className="divide-y divide-foreground/10">
            {groups.map((g) => {
              const isOpen = expanded.includes(g.id);
              const label = displayCourseName(g.name, g.code);
              return (
                <div key={g.id} className="py-1.5" {...highlight(label)}>
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
                    <h2 className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-[0.14em] text-foreground/80">
                      {label}
                    </h2>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                      {g.items.length}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="mt-2 space-y-3">
                      {g.items.map((a) => (
                        <div key={a.id} className="glass-inset glass-hover p-3 sm:p-4">
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
                          <p className="mt-2 line-clamp-6 whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
                            {stripHtml(a.message)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

    </div>
  );
}
