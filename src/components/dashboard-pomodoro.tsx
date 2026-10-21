import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CirclePause, CirclePlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudySession } from "@/hooks/use-study-session";
import { advanceSession, isBreak, phaseOf, remainingForSession } from "@/lib/study-session";

function formatTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

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

  useEffect(() => {
    if (!session?.pomodoro || session.status !== "running" || remainingForSession(session, now) > 0) {
      return;
    }
    const result = advanceSession(session, now);
    if (result.changed) setSession(result.session);
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
    <div className="flex h-12 w-auto shrink-0 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 p-1.5 pl-4">
      <span className="min-w-20">
        <span className="block text-[11px] text-muted-foreground">
          {session.status === "paused" ? "Paused" : phaseLabel}
        </span>
        <span className="block text-sm font-medium tabular-nums">{formatTime(remaining)}</span>
      </span>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={pauseOrResume}
        className="h-9 w-9 rounded-full"
        aria-label={session.status === "running" ? "Pause Pomodoro" : "Resume Pomodoro"}
      >
        {session.status === "running" ? <CirclePause /> : <CirclePlay />}
      </Button>
      <Button asChild size="icon" variant="ghost" className="h-9 w-9 rounded-full">
        <Link to="/study-session" search={{ assignment: undefined }} aria-label="Open Pomodoro timer">
          <ArrowUpRight />
        </Link>
      </Button>
      {isBreak(session) && <span className="sr-only">Break in progress</span>}
    </div>
  );
}