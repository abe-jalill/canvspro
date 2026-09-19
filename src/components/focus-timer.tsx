import { cn } from "@/lib/utils";
import { TrafficLights } from "@/components/traffic-lights";
import {
  useFocusTimer,
  closeTimer,
  toggleMinimize,
  toggleRun,
  resetTimer,
  addTimerMinutes,
} from "@/lib/focus-timer-store";
import { Play, Pause, RotateCcw, Timer } from "lucide-react";

function mmss(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact floating study timer, opened from an assignment's time estimate.
 * Red dot closes, yellow dot minimizes to a pill, green dot starts/pauses.
 */
export function FocusTimerPanel() {
  const t = useFocusTimer();

  if (!t.open) return null;

  if (t.minimized) {
    return (
      <button
        type="button"
        onClick={toggleMinimize}
        className="glass-panel-strong fixed right-3 top-16 z-50 flex items-center gap-2 rounded-full px-3 py-2 text-sm shadow-lg sm:right-6 sm:top-20"
        aria-label="Expand study timer"
      >
        <Timer className="h-4 w-4 text-muted-foreground" />
        <span className="tabular-nums">{mmss(t.remainingMs)}</span>
      </button>
    );
  }

  const plannedMs = t.plannedMinutes * 60_000;
  const progress = plannedMs > 0 ? 1 - t.remainingMs / plannedMs : 0;

  return (
    <aside
      className="glass-panel-strong fixed right-3 top-16 z-50 w-60 rounded-2xl p-3 shadow-xl sm:right-6 sm:top-20"
      aria-label="Study timer"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-medium text-foreground/90">
          {t.name || "Study session"}
        </p>
        <TrafficLights
          className="shrink-0 scale-90 px-1.5 py-0.5"
          onRed={closeTimer}
          onYellow={toggleMinimize}
          onGreen={toggleRun}
        />
      </div>

      <p
        className={cn(
          "mt-2 text-center text-3xl font-semibold tabular-nums tracking-tight",
          t.running ? "text-foreground" : "text-foreground/70",
        )}
      >
        {mmss(t.remainingMs)}
      </p>

      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-foreground/70 transition-[width] duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={toggleRun}
          className="glass-hover inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-semibold text-background"
        >
          {t.running ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> {t.remainingMs <= 0 ? "Restart" : "Start"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={resetTimer}
          aria-label="Reset timer"
          title="Reset"
          className="glass-inset flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => addTimerMinutes(5)}
          className="glass-inset min-h-9 rounded-xl px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          +5 min
        </button>
      </div>
    </aside>
  );
}
