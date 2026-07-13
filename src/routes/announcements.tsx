import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getAnnouncementsFn } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { displayCourseName, displayCourseCode } from "@/lib/course-display";
import { useLocalSet, DISMISSED_ANNOUNCEMENTS_KEY } from "@/lib/local-state";
import { X, RotateCcw } from "lucide-react";

const announcementsQO = queryOptions({
  queryKey: ["canvas", "announcements"],
  queryFn: () => getAnnouncementsFn(),
  staleTime: 5 * 60_000,
});

export const Route = createFileRoute("/announcements")({
  head: () => ({
    meta: [
      { title: "Announcements — Canvas Student" },
      {
        name: "description",
        content: "All recent announcements from your Canvas courses.",
      },
    ],
  }),
  component: AnnouncementsPage,
});

function stripHtml(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function AnnouncementsPage() {
  const { data, isLoading, isError, error } = useQuery(announcementsQO);
  const dismissed = useLocalSet(DISMISSED_ANNOUNCEMENTS_KEY);

  const items = (data ?? []).filter((a) => !dismissed.has(a.id));
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
      {!isLoading && !isError && items.length === 0 && (
        <GlassCard>
          <EmptyState message="No announcements to show." />
        </GlassCard>
      )}

      {Array.from(groups.entries()).map(([id, g]) => (
        <GlassCard
          key={id}
          title={displayCourseName(g.name, g.code)}
          subtitle={
            displayCourseCode(g.name, g.code) === displayCourseName(g.name, g.code)
              ? g.code
              : g.name
          }
        >
          <div className="space-y-3">
            {g.items.map((a) => (
              <div key={a.id} className="glass-inset glass-hover p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {a.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(a.posted_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <button
                      onClick={() => dismissed.add(a.id)}
                      aria-label={`Dismiss ${a.title}`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-foreground/20 text-muted-foreground transition-colors hover:border-foreground/50 hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {stripHtml(a.message)}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
