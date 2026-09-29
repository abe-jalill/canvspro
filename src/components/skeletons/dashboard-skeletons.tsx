import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/glass-card";

/** Shimmer bar primitive using the sleek glass skeleton gradient */
export function SkeletonBlock({
  className,
  rounded = "rounded-lg",
}: {
  className?: string;
  rounded?: string;
}) {
  return <div className={cn("skeleton-shimmer", rounded, className)} />;
}

/** Exact skeleton for a class row in ClassesWidget or Grades preview */
export function CourseRowSkeleton({ index = 0 }: { index?: number }) {
  // Stagger widths slightly for natural look
  const titleWidths = ["w-44 sm:w-56", "w-36 sm:w-48", "w-48 sm:w-60", "w-32 sm:w-40"];
  const width = titleWidths[index % titleWidths.length];

  return (
    <div className="glass-inset flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {/* Grade color dot placeholder */}
        <div className="skeleton-shimmer h-2.5 w-2.5 shrink-0 rounded-full" />
        {/* Course code & name */}
        <div className="space-y-1.5 min-w-0">
          <SkeletonBlock className={cn("h-4", width)} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* Syllabus button placeholder */}
        <SkeletonBlock className="h-7 w-16 rounded-lg" />
        {/* Grade percentage */}
        <SkeletonBlock className="h-4 w-12" />
      </div>
    </div>
  );
}

/** Full Classes & Grades widget skeleton */
export function ClassesWidgetSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <CourseRowSkeleton key={i} index={i} />
      ))}
    </div>
  );
}

/** Exact skeleton for an assignment row in UpcomingWidget or FocusWidget */
export function AssignmentRowSkeleton({
  index = 0,
  showCalendarBtn = true,
}: {
  index?: number;
  showCalendarBtn?: boolean;
}) {
  const widths = ["w-48 sm:w-64", "w-36 sm:w-52", "w-56 sm:w-72", "w-40 sm:w-56"];
  const width = widths[index % widths.length];

  return (
    <div className="glass-inset flex items-center justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* Checkbox square placeholder */}
        <div className="skeleton-shimmer h-5 w-5 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <SkeletonBlock className={cn("h-4", width)} />
          <SkeletonBlock className="h-2.5 w-24" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right space-y-1">
          <SkeletonBlock className="h-3.5 w-16" />
          <SkeletonBlock className="hidden sm:block h-2.5 w-20" />
        </div>
        {showCalendarBtn && <SkeletonBlock className="h-7 w-7 rounded-md" />}
      </div>
    </div>
  );
}

/** Accordion group skeleton for UpcomingWidget */
export function UpcomingWidgetSkeleton({ groupCount = 3 }: { groupCount?: number }) {
  return (
    <div className="divide-y divide-foreground/10 space-y-2">
      {Array.from({ length: groupCount }).map((_, i) => (
        <div key={i} className="py-1.5 space-y-2">
          {/* Group header */}
          <div className="flex min-h-11 items-center gap-3 px-1.5">
            <SkeletonBlock className="h-4 w-4 rounded-md" />
            <SkeletonBlock className="h-2.5 w-2.5 rounded-full" />
            <SkeletonBlock className="h-4 w-36 sm:w-48" />
            <SkeletonBlock className="ml-auto h-4 w-6 rounded-full" />
          </div>
          {/* Assignment items in first group */}
          {i === 0 && (
            <div className="space-y-2 pt-1 pl-4">
              <AssignmentRowSkeleton index={0} />
              <AssignmentRowSkeleton index={1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Announcements Widget Skeleton */
export function AnnouncementsWidgetSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-inset flex items-start gap-3 p-3 sm:p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <SkeletonBlock className="h-4 w-44 sm:w-60" />
              <SkeletonBlock className="h-3 w-16" />
            </div>
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-4/5" />
          </div>
          <SkeletonBlock className="h-6 w-6 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Calendar Widget Skeleton */
export function CalendarWidgetSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-inset flex items-center justify-between gap-3 p-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <SkeletonBlock className="h-4 w-40 sm:w-56" />
            <SkeletonBlock className="h-2.5 w-28" />
          </div>
          <SkeletonBlock className="h-3.5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Digest Widget Skeleton matching DigestCard */
export function DigestWidgetSkeleton() {
  return (
    <GlassCard title="Since your last visit">
      <div className="space-y-4">
        {/* Overview pill stats */}
        <div className="flex flex-wrap gap-2">
          <SkeletonBlock className="h-7 w-28 rounded-full" />
          <SkeletonBlock className="h-7 w-32 rounded-full" />
          <SkeletonBlock className="h-7 w-24 rounded-full" />
        </div>
        {/* Quick summary highlight banner */}
        <div className="glass-inset space-y-2 p-4">
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="h-3.5 w-3/4" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
        {/* Preview rows */}
        <div className="space-y-2">
          <SkeletonBlock className="h-12 rounded-xl" />
          <SkeletonBlock className="h-12 rounded-xl" />
        </div>
      </div>
    </GlassCard>
  );
}

/** Heatmap Widget Skeleton matching WorkloadHeatmap */
export function WorkloadHeatmapSkeleton() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="space-y-3">
      {/* Month headers */}
      <div className="flex justify-between px-10 text-[10px]">
        <SkeletonBlock className="h-3 w-10" />
        <SkeletonBlock className="h-3 w-10" />
        <SkeletonBlock className="h-3 w-10" />
        <SkeletonBlock className="h-3 w-10" />
      </div>
      {/* Grid of days */}
      <div className="space-y-1.5">
        {days.map((day) => (
          <div key={day} className="flex items-center gap-2">
            <span className="w-8 text-[10px] text-muted-foreground">{day}</span>
            <div className="flex flex-1 gap-1.5 overflow-hidden">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-shimmer h-3.5 w-3.5 shrink-0 rounded-sm opacity-60"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <SkeletonBlock className="h-2.5 w-10" />
        <div className="flex gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-3 w-3 rounded-xs opacity-70" />
          ))}
        </div>
        <SkeletonBlock className="h-2.5 w-10" />
      </div>
    </div>
  );
}

/** Grades Page Skeleton - multiple class grade cards */
export function CourseGradeCardSkeleton({ index = 0 }: { index?: number }) {
  const widths = ["w-52 sm:w-72", "w-44 sm:w-60", "w-60 sm:w-80", "w-40 sm:w-56"];
  const width = widths[index % widths.length];

  return (
    <GlassCard className="p-0 sm:p-0 md:p-0">
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Grade dot indicator */}
            <div className="skeleton-shimmer h-3 w-3 shrink-0 rounded-full" />
            <div className="space-y-1.5 min-w-0">
              <SkeletonBlock className={cn("h-5", width)} />
              <SkeletonBlock className="h-3 w-28" />
            </div>
          </div>
          {/* Grade score & letter grade chip */}
          <div className="flex items-center gap-2 shrink-0">
            <SkeletonBlock className="h-7 w-20 rounded-xl" />
            <SkeletonBlock className="h-7 w-7 rounded-lg" />
          </div>
        </div>

        {/* Mini progress bar and trend summary */}
        <div className="space-y-2 pt-1">
          <SkeletonBlock className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="h-3 w-20" />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/** Assignment Page Class Group Skeleton */
export function AssignmentGroupSkeleton({ index = 0 }: { index?: number }) {
  const widths = ["w-48 sm:w-64", "w-40 sm:w-56", "w-56 sm:w-72"];
  const width = widths[index % widths.length];

  return (
    <GlassCard className="p-0 sm:p-0 md:p-0">
      <div className="p-4 sm:p-6 space-y-4">
        {/* Accordion trigger header */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            <SkeletonBlock className={cn("h-5", width)} />
            <div className="flex gap-2">
              <SkeletonBlock className="h-3 w-20" />
              <SkeletonBlock className="h-3 w-24" />
            </div>
          </div>
          <SkeletonBlock className="h-8 w-8 rounded-full" />
        </div>

        {/* 2-3 assignment items */}
        <div className="space-y-2 pt-2 border-t border-foreground/10">
          <AssignmentRowSkeleton index={index * 2} showCalendarBtn={false} />
          <AssignmentRowSkeleton index={index * 2 + 1} showCalendarBtn={false} />
        </div>
      </div>
    </GlassCard>
  );
}
