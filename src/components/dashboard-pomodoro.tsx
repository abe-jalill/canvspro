import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CirclePause, CirclePlay, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudySession } from "@/hooks/use-study-session";
import {
  POMODORO_PRESETS,
  advanceSession,
  createStudySession,
  isBreak,
  phaseOf,
  remainingForSession,
} from "@/lib/study-session";

const INDEPENDENT_FOCUS_ITEM = {
  id: "manual:independent-focus",
  name: "Independent focus",
  source: "manual" as const,
};

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

  if (!ready) {
    return <div className="h-12 w-full animate-pulse rounded-lg bg-muted/40 sm:ml-auto sm:w-64" />;
  }

  if (!session) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          const plan = POMODORO_PRESETS[0].plan;
          setSession(createStudySession([INDEPENDENT_FOCUS_ITEM], 25, Date.now(), plan));
          setNow(Date.now());
        }}
        className="h-12 w-full justify-start rounded-lg border-foreground/15 bg-background/35 px-3 shadow-none backdrop-blur-md hover:border-foreground/30 sm:ml-auto sm:w-auto"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-foreground/20">
          <TimerReset className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-sm font-medium">Start Pomodoro</span>
          <span className="block text-[11px] text-muted-foreground">25 min · no assignment</span>
        </span>
      </Button>
    );
  }

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
    <div className="flex h-12 w-full items-center gap-2 rounded-lg border border-foreground/15 bg-background/35 p-1.5 pl-3 backdrop-blur-md sm:ml-auto sm:w-auto">
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