import { AssignmentEstimateEditor } from "@/components/assignment-estimate";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AssignmentDescriptionLink } from "@/components/assignment-description-link";
import type { AssignmentItem } from "@/lib/canvas.functions";
import { displayCourseName } from "@/lib/course-display";
import { useAssignmentMetaMap } from "@/hooks/use-assignment-meta";
import { remainingWork, workloadWeekSummary } from "@/lib/assignment-workload";
import { dueTodayClass, formatAssignmentDue } from "@/lib/assignment-due";

interface Props {
  assignments: AssignmentItem[];
  weeks?: number;
  /** Today's work gets the yellow outline only on the Dashboard. */
  outlineDueToday?: boolean;
}

interface DayCell {
  date: Date;
  key: string;
  items: AssignmentItem[];
  remaining: number;
}

const WEEK_NAMES = ["This week", "Next week", "Week 3", "Week 4"];

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

/**
 * One week at a time with a switcher (This week, Next week, Week 3, Week 4),
 * the same as the iPhone app: a bar per day sized by the work left (points
 * after saved progress), and the day's work below when a day is picked.
 */
export function WorkloadHeatmap({ assignments, weeks = 4, outlineDueToday = false }: Props) {
  const [week, setWeek] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const metaMap = useAssignmentMetaMap();

  const weekRows = useMemo(() => {
    const start = startOfWeekMonday(new Date());
    const cells: DayCell[] = [];
    for (let i = 0; i < weeks * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      cells.push({ date: d, key: d.toDateString(), items: [], remaining: 0 });
    }
    const byKey = new Map(cells.map((c) => [c.key, c]));
    assignments.forEach((a) => {
      if (!a.due_at) return;
      const d = new Date(a.due_at);
      const cell = byKey.get(new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString());
      if (!cell) return;
      cell.items.push(a);
      cell.remaining += remainingWork(a, metaMap.get(a.id)?.progressPercent);
    });
    for (const cell of cells) {
      cell.items.sort((a, b) => Date.parse(a.due_at ?? "") - Date.parse(b.due_at ?? ""));
    }
    return Array.from({ length: weeks }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [assignments, metaMap, weeks]);

  const shown = weekRows[Math.min(week, weekRows.length - 1)] ?? [];
  // Bar heights compare the days of the week on screen.
  const maxLoad = Math.max(1, ...shown.map((c) => c.remaining));
  const openCell = shown.find((c) => c.key === open && c.items.length > 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const first = shown[0]?.date;
  const last = shown[shown.length - 1]?.date;
  const range = (d?: Date) => d?.toLocaleDateString(undefined, { month: "short", day: "numeric" }) ?? "";

  return (
    <div className="space-y-3.5">
      <div
        className="grid gap-1 rounded-2xl border border-foreground/10 bg-foreground/[0.04] p-1"
        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
        role="group"
        aria-label="Week"
      >
        {WEEK_NAMES.slice(0, weeks).map((name, index) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setWeek(index);
              setOpen(null);
            }}
            aria-pressed={week === index}
            className={cn(
              "min-h-8 truncate rounded-xl px-2 text-xs font-medium transition-colors",
              week === index
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3 px-0.5 text-xs text-muted-foreground">
        <span>
          {range(first)} – {range(last)}
        </span>
        <span className="tabular-nums">
          {workloadWeekSummary(shown.map((c) => ({ date: c.date, count: c.items.length })))}
        </span>
      </div>

      <div className="grid grid-cols-7 items-end gap-1.5">
        {shown.map((cell) => {
          const count = cell.items.length;
          const isToday = sameDay(cell.date, today);
          const isPast = cell.date < today;
          const isOpen = open === cell.key;
          const share = cell.remaining / maxLoad;
          return (
            <button
              key={cell.key}
              type="button"
              onClick={() => count > 0 && setOpen(isOpen ? null : cell.key)}
              aria-pressed={isOpen}
              aria-label={`${cell.date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}: ${count} due, ${Math.round(cell.remaining)} points of work left`}
              className={cn(
                "flex min-w-0 flex-col items-center gap-2 rounded-xl py-2 transition-colors",
                isOpen ? "bg-foreground/[0.07]" : count > 0 && "hover:bg-foreground/[0.04]",
                count === 0 && "cursor-default",
              )}
            >
              <span className="h-4 text-xs font-medium tabular-nums text-foreground">
                {count > 0 ? count : ""}
              </span>
              <span className="flex h-[60px] items-end">
                {/* In the palette, as on the iPhone: stronger for heavier days, solid when
                    picked, half strength for days already past. */}
                <span
                  className={cn(
                    "w-[18px] rounded-[5px] transition-[height,opacity] duration-300 motion-reduce:transition-none",
                    count === 0 ? "bg-foreground" : "bg-gradient-to-b from-primary to-primary/45",
                  )}
                  style={{
                    height: count === 0 ? 4 : 10 + 50 * share,
                    opacity:
                      count === 0 ? 0.08 : (isOpen ? 1 : 0.55 + 0.45 * share) * (isPast ? 0.5 : 1),
                  }}
                  aria-hidden="true"
                />
              </span>
              <span className="flex flex-col items-center gap-0.5">
                <span className="text-[11px] text-muted-foreground">
                  {cell.date.toLocaleDateString(undefined, { weekday: "narrow" })}
                </span>
                <span
                  className={cn(
                    "flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] tabular-nums",
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : isPast
                        ? "text-foreground/45"
                        : "text-foreground/90",
                  )}
                >
                  {cell.date.getDate()}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {openCell ? (
        <div className="space-y-2">
          <p className="px-0.5 text-xs font-medium text-foreground">
            {formatAssignmentDue(openCell.date.toISOString(), Date.now(), false)}
          </p>
          <ul className="space-y-1.5">
            {openCell.items.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "glass-inset flex items-start justify-between gap-3 rounded-xl border border-transparent p-3",
                  outlineDueToday && dueTodayClass(a.due_at),
                )}
              >
                <div className="min-w-0">
                  <p className="break-words text-[13px] font-medium">{a.name}</p>
                  <p className="break-words text-[11px] text-muted-foreground">
                    {displayCourseName(a.course_name, a.course_code)}
                  </p>
                  <AssignmentDescriptionLink assignmentId={a.id} className="mt-0.5" />
                  <AssignmentEstimateEditor assignment={a} className="mt-2" />
                </div>
                <div className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {a.due_at && <p>{formatAssignmentDue(a.due_at)}</p>}
                  {a.points_possible != null && (
                    <p className="opacity-75">
                      {(metaMap.get(a.id)?.progressPercent ?? 0) > 0
                        ? `${Math.round(remainingWork(a, metaMap.get(a.id)?.progressPercent))} of ${a.points_possible} pts left`
                        : `${a.points_possible} pts`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        shown.every((c) => c.items.length === 0) && (
          <p className="text-center text-xs text-muted-foreground/70">A clear week.</p>
        )
      )}
    </div>
  );
}
