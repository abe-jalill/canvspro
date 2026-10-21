import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CirclePause, CirclePlay } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStudySession } from "@/hooks/use-study-session";
import {
  advanceSession,
  formatStudyClock,
  isBreak,
  nextItemSession,
  phaseOf,
  remainingForSession,
} from "@/lib/study-session";

export function DashboardPomodoro() {
  const { session, setSession, ready } = useStudySession();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!session || session.status !== "running") return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [session]);

  // Time's up while Today is open: the same next step as on Study Session, so
  // the pill never sits at 0:00.
  useEffect(() => {
    if (!session || session.status !== "running" || remainingForSession(session, now) > 0) return;
    if (session.pomodoro) {
      const result = advanceSession(session, now);
      if (result.changed) setSession(result.session);
      return;
    }
    const next = session.perItem ? nextItemSession(session, now) : null;
    if (next) {
      setSession(next);
      return;
    }
    setSession(null);
    toast.success("Study session complete");
  }, [now, session, setSession]);

  // Only while a study session runs (a quick Pomodoro or one started from Study
  // Session): its time left beside the greeting. Nothing otherwise.
  if (!ready || !session) return null;

  const remaining = remainingForSession(session, now);
  const phase = phaseOf(session);
  const phaseLabel = !session.pomodoro
    ? "Study timer"
    : phase === "focus"
      ? "Focus"
      : phase === "long-break"
        ? "Long break"
        : "Short break";

  const pauseOrResume = () => {
    if (session.status === "running") {
      setSession({ ...session, status: "paused", remainingMs: remaining });
      return;
    }
    setSession({ ...session, status: "running", endsAt: Date.now() + session.remainingMs });
    setNow(Date.now());
  };

  return (
    <div className="flex h-10 w-auto shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-1 pl-3.5 pr-1">
      <span className="flex items-baseline gap-2 pr-1">
        <span className="text-xs text-muted-foreground">
          {session.status === "paused" ? "Paused" : phaseLabel}
        </span>
        <span className="text-sm font-medium tabular-nums">{formatStudyClock(remaining)}</span>
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={pauseOrResume}
        className="h-8 w-8 rounded-full"
        aria-label={`${session.status === "running" ? "Pause" : "Resume"} ${session.pomodoro ? "Pomodoro" : "study timer"}`}
      >
        {session.status === "running" ? <CirclePause /> : <CirclePlay />}
      </Button>
      <Button asChild size="icon" variant="ghost" className="h-8 w-8 rounded-full">
        <Link
          to="/study-session"
          search={{ assignment: undefined }}
          aria-label={session.pomodoro ? "Open Pomodoro timer" : "Open study timer"}
        >
          <ArrowUpRight />
        </Link>
      </Button>
      {isBreak(session) && <span className="sr-only">Break in progress</span>}
    </div>
  );
}