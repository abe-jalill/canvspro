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

import {
  calendarQueryOptions as eventsQO,
  assignmentsQueryOptions as assignmentsQO,
} from "@/lib/canvas.queries";
import { SkeletonBlock, WorkloadHeatmapSkeleton } from "@/components/skeletons/dashboard-skeletons";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";

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
  loader: ({ context }) => {
    if (context?.queryClient) {
      void context.queryClient.ensureQueryData(eventsQO);
      void context.queryClient.ensureQueryData(assignmentsQO);
    }
  },
  component: SchedulePage,
});

interface AgendaItem {
  key: string;
  title: string;
  when: Date;
  context?: string;
  kind: "event" | "assignment";
  assignmentId?: number;
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
      assignmentId: a.id,
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

      <GlassCard title="Workload" subtitle="Assignment density by week">
        {assignments.isLoading ? (
          <WorkloadHeatmapSkeleton />
        ) : (
          <WorkloadHeatmap assignments={assignments.data ?? []} />
        )}
      </GlassCard>

      <GlassCard>
        {loading && (
          <div className="space-y-6">
            {Array.from({ length: 2 }).map((_, dayIdx) => (
              <div key={dayIdx} className="space-y-2">
                <div className="mb-2 flex items-baseline justify-between border-b border-foreground/10 pb-2">
                  <SkeletonBlock className="h-4 w-32" />
                  <SkeletonBlock className="h-3 w-12" />
                </div>
                <div className="space-y-2">
                  <div className="glass-inset flex items-center justify-between gap-3 p-3">
                    <div className="space-y-1.5 min-w-0">
                      <SkeletonBlock className="h-4 w-48 sm:w-64" />
                      <SkeletonBlock className="h-2.5 w-24" />
                    </div>
                    <SkeletonBlock className="h-3.5 w-16" />
                  </div>
                  <div className="glass-inset flex items-center justify-between gap-3 p-3">
                    <div className="space-y-1.5 min-w-0">
                      <SkeletonBlock className="h-4 w-36 sm:w-48" />
                      <SkeletonBlock className="h-2.5 w-20" />
                    </div>
                    <SkeletonBlock className="h-3.5 w-16" />
                  </div>
                </div>
              </div>
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
                        {it.assignmentId != null && (
                          <AssignmentDescriptionLink
                            assignmentId={it.assignmentId}
                            className="mt-1"
                          />
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
