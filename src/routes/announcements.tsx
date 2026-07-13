import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { getAnnouncementsFn } from "@/lib/canvas.functions";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";

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

  return (
    <div className="space-y-6">
      <header className="px-1 pt-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Last 30 days
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">
          Announcements
        </h1>
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
      {!isLoading && !isError && (data?.length ?? 0) === 0 && (
        <GlassCard>
          <EmptyState message="No recent announcements." />
        </GlassCard>
      )}

      {(data ?? []).map((a) => (
        <GlassCard key={a.id}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold tracking-tight">{a.title}</h2>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {new Date(a.posted_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <p className="mt-3 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            {stripHtml(a.message)}
          </p>
        </GlassCard>
      ))}
    </div>
  );
}
