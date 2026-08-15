import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";

interface Props {
  assignments: AssignmentItem[];
  weeks?: number;
}

interface DayCell {
  date: Date;
  key: string;
  items: AssignmentItem[];
  points: number;
}

function startOfWeekMonday(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  const day = (c.getDay() + 6) % 7; // Mon=0
  c.setDate(c.getDate() - day);
  return c;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function WorkloadHeatmap({ assignments, weeks = 4 }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  const { cells, weekRows, maxCount } = useMemo(() => {
    const start = startOfWeekMonday(new Date());
    const cells: DayCell[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({
        date: d,
        key: d.toDateString(),
        items: [],
        points: 0,
      });
    }
    const byKey = new Map(cells.map((c) => [c.key, c]));
    assignments.forEach((a) => {
      if (!a.due_at) return;
      const d = new Date(a.due_at);
      const key = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
      ).toDateString();
      const cell = byKey.get(key);
      if (!cell) return;
      cell.items.push(a);
      cell.points += a.points_possible ?? 0;
    });
    const weekRows: DayCell[][] = [];
    for (let w = 0; w < weeks; w++) {
      weekRows.push(cells.slice(w * 7, w * 7 + 7));
    }
    const maxCount = Math.max(1, ...cells.map((c) => c.items.length));
    return { cells, weekRows, maxCount };
  }, [assignments, weeks]);

  const today = new Date();
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h3 className="text-sm font-semibold tracking-tight">
          Workload — next {weeks} weeks
        </h3>
        <span className="text-xs text-muted-foreground">
          {cells.reduce((n, c) => n + c.items.length, 0)} items
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5 px-1 pb-1">
        {dayLabels.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] uppercase tracking-widest text-muted-foreground"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        {weekRows.map((row, wi) => {
          const openCell = row.find((c) => c.key === open && c.items.length > 0);
          return (
            <div key={wi}>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {row.map((cell) => {
                  const isToday = sameDay(cell.date, today);
                  const intensity = cell.items.length / maxCount; // 0..1
                  const bg =
                    cell.items.length === 0
                      ? "rgb(255 255 255 / 0.03)"
                      : `rgb(255 255 255 / ${(0.08 + intensity * 0.35).toFixed(3)})`;
                  return (
                    <button
                      key={cell.key}
                      onClick={() =>
                        setOpen((prev) => (prev === cell.key ? null : cell.key))
                      }
                      className={cn(
                        "glass-hover flex aspect-square w-full min-w-0 flex-col items-center justify-center rounded-xl border p-0.5 text-xs transition-all sm:p-1",
                        isToday
                          ? "border-white/60 ring-1 ring-white/40"
                          : "border-glass-border",
                        open === cell.key && "ring-1 ring-white/50",
                      )}
                      style={{ background: bg }}
                      aria-label={`${cell.date.toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}: ${cell.items.length} due, ${Math.round(cell.points)} points`}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-medium tabular-nums",
                          isToday ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                      <span className="mt-0.5 text-[11px] font-semibold tabular-nums">
                        {cell.items.length > 0 ? cell.items.length : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              {openCell && (
                <div className="glass-panel-strong mt-2 w-full p-3 text-left">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {openCell.date.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <ul className="space-y-1.5">
                    {openCell.items.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-baseline justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{a.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {displayCourseName(a.course_name, a.course_code)}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {a.points_possible ?? 0} pt
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
