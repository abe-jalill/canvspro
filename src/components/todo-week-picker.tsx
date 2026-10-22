import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfLocalDay } from "@/lib/todo-week";
import type { DayProgress } from "@/lib/week-progress";

export function TodoWeekPicker({
  days, now, selectedDay, weekOffset, onSelectDay, onChangeWeek, onToday,
}: {
  days: DayProgress[];
  now: number;
  selectedDay: number;
  weekOffset: number;
  onSelectDay: (day: number) => void;
  onChangeWeek: (offset: number) => void;
  onToday: () => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const move = (direction: number) => {
    const offset = weekOffset + direction;
    if (offset >= 0 && offset < 4) onChangeWeek(offset);
  };
  const format = (date: number) =>
    new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <section className="touch-pan-y select-none space-y-3" aria-label="Choose a day, Sunday through Saturday"
      onTouchStart={(event) => {
        const point = event.touches[0];
        touch.current = { x: point.clientX, y: point.clientY };
      }}
      onTouchCancel={() => { touch.current = null; }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const point = event.changedTouches[0];
        const dx = point.clientX - start.x, dy = point.clientY - start.y;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div aria-live="polite" aria-atomic="true">
          <p className="text-sm font-medium">{weekOffset === 0 ? "This week" : `Week ${weekOffset + 1}`}</p>
          <p className="text-xs text-muted-foreground">{format(days[0].date)} – {format(days[6].date)}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onToday}
            className="glass-hover min-h-11 rounded-lg px-3 text-xs font-medium">Today</button>
          <button type="button" disabled={weekOffset === 0} onClick={() => move(-1)}
            aria-label="Previous week" className="glass-hover grid h-11 w-11 place-items-center rounded-lg disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" disabled={weekOffset === 3} onClick={() => move(1)}
            aria-label="Next week" className="glass-hover grid h-11 w-11 place-items-center rounded-lg disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Days of the week">
        {days.map((day) => {
          const selected = selectedDay === day.date;
          const isToday = startOfLocalDay(now) === day.date;
          return (
            <button key={day.date} type="button" onClick={() => onSelectDay(day.date)}
              aria-pressed={selected} aria-current={isToday ? "date" : undefined}
              aria-label={`${new Date(day.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}, ${day.total - day.done} tasks left`}
              className={cn("press flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-xs transition-colors",
                selected ? "border-primary bg-primary/15 text-primary" : "glass-panel border-foreground/10 text-muted-foreground hover:border-foreground/30")}
            >
              <span className={cn("text-[10px] sm:text-xs", isToday && "font-semibold text-primary")}>
                {new Date(day.date).toLocaleDateString(undefined, { weekday: "short" })}
              </span>
              <span className="text-base font-medium tabular-nums">{new Date(day.date).getDate()}</span>
              <span className={cn("h-1 w-1 rounded-full", day.total === 0 ? "bg-transparent" :
                day.done === day.total ? "bg-primary" : "bg-current")} aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
