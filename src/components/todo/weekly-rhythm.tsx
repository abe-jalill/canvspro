import { cn } from "@/lib/utils";
import { RHYTHM_AIM, rhythmLine } from "@/lib/todo-insights";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * A gentle weekly rhythm (off unless turned on): the days this week you
 * finished something. Rest days are fine, nothing resets to zero, and every
 * week starts fresh.
 */
export function WeeklyRhythm({ days, now }: { days: boolean[]; now: number }) {
  const today = new Date(now).getDay();
  const active = days.filter(Boolean).length;
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-foreground/10 px-3 py-2.5"
      aria-label={`Weekly rhythm: ${active} active days this week, aiming for ${RHYTHM_AIM}. ${rhythmLine(days, now)}`}
      role="group"
    >
      <div className="flex gap-1.5" aria-hidden="true">
        {days.map((on, i) => (
          <span key={i} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                on ? "bg-primary" : i > today ? "border border-foreground/15" : "bg-foreground/15",
              )}
            />
            <span
              className={cn(
                "text-[10px] text-muted-foreground",
                i === today && "font-semibold text-foreground",
              )}
            >
              {LETTERS[i]}
            </span>
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{rhythmLine(days, now)}</p>
    </div>
  );
}
