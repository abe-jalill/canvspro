import { useMemo } from "react";
import { useGradeSnapshots, type GradeSnapshot } from "@/hooks/use-grade-snapshots";
import { getGradeColor, getGradeBg } from "@/lib/grade-color";
import { GlassCard, Skeleton } from "@/components/glass-card";

/**
 * Grade-over-time line chart for one class, fed by the grade_snapshots
 * table (a point is recorded whenever the live Canvas grade changes).
 */
export function GradeHistoryCard({ courseId }: { courseId: number }) {
  const { data, isLoading } = useGradeSnapshots();

  const points = useMemo(() => {
    return (data ?? [])
      .filter((s) => s.courseId === courseId)
      .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  }, [data, courseId]);

  return (
    <GlassCard
      title="Grade history"
      subtitle={
        points.length >= 2
          ? `${points.length} recorded points this term`
          : "Builds automatically as your grade changes"
      }
    >
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <GradeChart points={points} />
      )}
    </GlassCard>
  );
}

function GradeChart({ points }: { points: GradeSnapshot[] }) {
  if (points.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Not enough history yet. Every time your grade moves in Canvas, a point
        is recorded here — check back after your next graded assignment.
      </p>
    );
  }

  const W = 600;
  const H = 170;
  const PAD_X = 12;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 26;

  const scores = points.map((p) => p.score);
  const rawMin = Math.min(...scores);
  const rawMax = Math.max(...scores);
  const pad = Math.max(2, (rawMax - rawMin) * 0.15);
  const yMin = Math.max(0, rawMin - pad);
  const yMax = Math.min(100, rawMax + pad);
  const ySpan = yMax - yMin || 1;

  const x = (i: number) =>
    PAD_X + (i / (points.length - 1)) * (W - PAD_X * 2);
  const y = (score: number) =>
    PAD_TOP + (1 - (score - yMin) / ySpan) * (H - PAD_TOP - PAD_BOTTOM);

  const coords = points.map((p, i) => ({ x: x(i), y: y(p.score) }));
  const line = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const area = `${line} L${coords[coords.length - 1].x},${H - PAD_BOTTOM} L${coords[0].x},${H - PAD_BOTTOM} Z`;

  const latest = scores[scores.length - 1];
  const lineColor = getGradeColor(latest);

  const firstDate = points[0].recordedAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const lastDate = points[points.length - 1].recordedAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-40 w-full"
        role="img"
        aria-label={`Grade history: now ${latest.toFixed(1)}%`}
      >
        <defs>
          <linearGradient id="grade-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#grade-fill)" />
        <path
          d={line}
          fill="none"
          stroke={lineColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={i === coords.length - 1 ? 4 : 2.5}
            fill={lineColor}
            opacity={i === coords.length - 1 ? 1 : 0.7}
          />
        ))}
        <text x={PAD_X} y={H - 8} fontSize="11" fill="currentColor" opacity="0.5">
          {firstDate}
        </text>
        <text
          x={W - PAD_X}
          y={H - 8}
          fontSize="11"
          fill="currentColor"
          opacity="0.5"
          textAnchor="end"
        >
          {lastDate}
        </text>
      </svg>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {points.length} point{points.length === 1 ? "" : "s"} recorded
        </span>
        <span
          className="rounded-full px-2 py-0.5 font-medium tabular-nums"
          style={{ color: lineColor, background: getGradeBg(latest) }}
        >
          Now {latest.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
