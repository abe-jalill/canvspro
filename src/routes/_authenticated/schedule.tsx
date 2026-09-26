import { createFileRoute } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { getCalendarEventsFn, getAllAssignmentsFn } from "@/lib/canvas.functions";
import { CANVAS_DATA_GC_MS, CANVAS_DATA_STALE_MS } from "@/lib/query-policy";
import { GlassCard, Skeleton, ErrorState, EmptyState } from "@/components/glass-card";
import { displayCourseName } from "@/lib/course-display";
import { Segmented } from "@/components/segmented";
import { WorkloadHeatmap } from "@/components/workload-heatmap";
import { endOfUpcomingDay } from "@/lib/assignment-window";

const eventsQO = queryOptions({
  queryKey: ["canvas", "calendar"],
  queryFn: () => getCalendarEventsFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
});

const assignmentsQO = queryOptions({
  queryKey: ["canvas", "assignments"],
  queryFn: () => getAllAssignmentsFn(),
  staleTime: CANVAS_DATA_STALE_MS,
  gcTime: CANVAS_DATA_GC_MS,
});

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Calendar — CanvasPro" },
      {
        name: "description",
        content: "Your upcoming Canvas due dates and events.",
      },
      { property: "og:title", content: "Calendar — CanvasPro" },
      {
        property: "og:description",
        content: "Your upcoming Canvas due dates and events.",
      },
    ],
  }),
  component: SchedulePage,
});

interface AgendaItem {
  key: string;
  title: string;
  when: Date;
  context?: string;
  kind: "event" | "assignment";
}

type Range = "week" | "semester";

function SchedulePage() {
  const events = useQuery(eventsQO);
  const assignments = useQuery(assignmentsQO);
  const [range, setRange] = useState<Range>("week");

  const now = Date.now();
  const rangeEnd = range === "week" ? endOfUpcomingDay(now, 7) : Number.POSITIVE_INFINITY;

  const items: AgendaItem[] = [];
  (events.data ?? []).forEach((e) => {
    if (!e.start_at) return;
    const when = new Date(e.start_at).getTime();
    if (!Number.isFinite(when) || when < now || when > rangeEnd) return;
    items.push({
      key: `e-${e.id}`,
      title: e.title,
      when: new Date(e.start_at),
      context: e.context_name
        ? displayCourseName(e.context_name, undefined)
        : (e.location_name ?? undefined),
      kind: "event",
    });
  });
  (assignments.data ?? []).forEach((a) => {
    if (!a.due_at) return;
    const when = new Date(a.due_at).getTime();
    if (!Number.isFinite(when) || when < now || when > rangeEnd) return;
    items.push({
      key: `a-${a.id}`,
      title: a.name,
      when: new Date(a.due_at),
      context: displayCourseName(a.course_name, a.course_code),
      kind: "assignment",
    });
  });

  items.sort((a, b) => a.when.getTime() - b.when.getTime());

  const grouped = new Map<string, AgendaItem[]>();
  items.forEach((i) => {
    const day = i.when.toDateString();
    const arr = grouped.get(day) ?? [];
    arr.push(i);
    grouped.set(day, arr);
  });

  const loading = events.isLoading || assignments.isLoading;
  const error = events.error || assignments.error;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 px-1 pt-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {range === "week" ? "Next 7 days" : "Full semester"}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight md:text-4xl">Calendar</h1>
        </div>
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { id: "week", label: "This Week" },
            { id: "semester", label: "Full Semester" },
          ]}
        />
      </header>

      <GlassCard>
        <WorkloadHeatmap assignments={assignments.data ?? []} />
      </GlassCard>

      <GlassCard>
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        )}
        {error && <ErrorState message={(error as Error).message} />}
        {!loading && !error && grouped.size === 0 && (
          <EmptyState
            message={
              range === "week"
                ? "Nothing scheduled in the next 7 days."
                : "Nothing scheduled for the semester."
            }
          />
        )}
        {!loading && !error && grouped.size > 0 && (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([day, dayItems]) => (
              <div key={day}>
                <div className="mb-2 flex items-baseline justify-between border-b border-foreground/10 pb-2">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {new Date(day).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {dayItems.length} {dayItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <ul className="space-y-2">
                  {dayItems.map((it) => (
                    <li
                      key={it.key}
                      className="glass-inset glass-hover flex items-start justify-between gap-3 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{it.title}</p>
                        {it.context && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {it.context}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {it.when.toLocaleTimeString(undefined, {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {it.kind === "event" ? "Event" : "Due"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
