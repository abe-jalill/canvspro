import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calculator,
  TrendingUp,
  GraduationCap,
  Info,
} from "lucide-react";
import { GlassCard } from "@/components/glass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getCoursesFn, type CourseSummary } from "@/lib/canvas.functions";
import { useClassSchedule } from "@/lib/user-class-schedule";
import { useNicknames } from "@/lib/nicknames";
import { displayCourseName, formatCleanTitle } from "@/lib/course-display";
import {
  computeGpa,
  DEFAULT_SCALE,
  scoreToGpa,
  type GpaResult,
} from "@/lib/gpa";

const coursesQuery = {
  queryKey: ["canvas", "courses"] as const,
  queryFn: getCoursesFn,
};

interface GpaCalculatorProps {
  className?: string;
}

function useGpa(): {
  result: GpaResult | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const courses = useQuery(coursesQuery);
  const schedule = useClassSchedule();
  const nicknames = useNicknames();

  const result = useMemo<GpaResult | null>(() => {
    if (!courses.data) return null;
    const creditsMap: Record<number, number> = {};

    for (const c of courses.data) {
      const customName = nicknames.data?.find(
        (nickname) => nickname.canvas_course_id === c.id,
      )?.custom_name;
      const display = customName
        ? formatCleanTitle(customName)
        : displayCourseName(c.name, c.course_code);
      // Match by schedule canvas_course_id first, then title/nickname, then code.
      const scheduleMatch = schedule.data?.find(
        (s) =>
          (s as unknown as { canvas_course_id?: number }).canvas_course_id ===
            c.id ||
          s.title.toLowerCase() === display.toLowerCase() ||
          s.code.toLowerCase() === (c.course_code ?? "").toLowerCase(),
      );
      if (scheduleMatch) {
        creditsMap[c.id] = scheduleMatch.credits;
      }
    }

    return computeGpa(courses.data, creditsMap, DEFAULT_SCALE);
  }, [courses.data, schedule.data, nicknames.data]);

  const isLoading = courses.isLoading || schedule.isLoading;
  const isError = courses.isError || schedule.isError;
  const error =
    (courses.error as Error | null) ?? (schedule.error as Error | null);

  return { result, isLoading, isError, error };
}

function GradeScaleRow({
  min,
  points,
}: {
  min: number;
  points: number;
}) {
  return (
    <div className="flex items-center justify-between py-1 text-xs text-muted-foreground">
      <span>{min}%+</span>
      <span>{points.toFixed(1)}</span>
    </div>
  );
}

export function GpaCalculator({ className }: GpaCalculatorProps) {
  const { result, isLoading, isError, error } = useGpa();
  const [showScale, setShowScale] = useState(false);

  if (isLoading) {
    return (
      <GlassCard className={cn("p-5", className)}>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-4 h-10 w-28" />
      </GlassCard>
    );
  }

  if (isError || !result) {
    return (
      <GlassCard className={cn("p-5", className)}>
        <p className="text-sm text-muted-foreground">
          {error?.message ?? "Could not load GPA data."}
        </p>
      </GlassCard>
    );
  }

  const scaleEntries = Object.entries(DEFAULT_SCALE)
    .map(([min, points]) => ({ min: Number(min), points }))
    .sort((a, b) => b.min - a.min);

  return (
    <GlassCard className={cn("p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              GPA
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              {result.gpa != null ? result.gpa.toFixed(2) : "—"}
            </h2>
          </div>
        </div>
        <button
          onClick={() => setShowScale((s) => !s)}
          className="glass-hover rounded-lg p-2 text-muted-foreground"
          aria-label="Toggle grading scale"
        >
          <Info className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="glass-inset rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Total credits</p>
          <p className="mt-1 font-semibold">{result.totalCredits.toFixed(1)}</p>
        </div>
        <div className="glass-inset rounded-xl p-3">
          <p className="text-xs text-muted-foreground">Counted</p>
          <p className="mt-1 font-semibold">{result.countedCredits.toFixed(1)}</p>
        </div>
      </div>

      {showScale && (
        <div className="mt-4 space-y-1 border-t border-foreground/10 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            4.0 scale
          </p>
          {scaleEntries.map((entry) => (
            <GradeScaleRow key={entry.min} min={entry.min} points={entry.points} />
          ))}
        </div>
      )}

      <div className="mt-4 text-xs text-muted-foreground">
        {result.entries.length} class
        {result.entries.length !== 1 ? "es" : ""} loaded.
      </div>
    </GlassCard>
  );
}
