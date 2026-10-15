import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, Snowflake } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStreak } from "@/hooks/use-streak";
import { useUserProfile } from "@/lib/user-profile";
import { useScopedKey } from "@/lib/user-scope";
import { cn } from "@/lib/utils";
import {
  nextMilestone,
  nextMonthStart,
  streakCelebrationCopy,
  streakWeek,
  STREAK_MILESTONES,
  type StreakDay,
  type StreakStatus,
} from "@/lib/streak";
import "./streak.css";

const CELEBRATED_KEY = "coursepro:streak-celebrated";

/** "Tue, Oct 13" for a `YYYY-MM-DD` date. */
function shortDate(key: string, withWeekday = true): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(undefined, {
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function useFirstName(): string | null {
  const profile = useUserProfile();
  const name = profile.data?.nickname?.trim() || profile.data?.firstName?.trim();
  return name ? (name.split(/\s+/)[0] ?? null) : null;
}

/** The streak flame: orange when today counted, grey when it hasn't yet. */
export function StreakFlame({ lit = true, className }: { lit?: boolean; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg
      viewBox="0 0 32 40"
      className={cn("streak-flame", lit ? "is-lit" : "is-out", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-outer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFB020" />
          <stop offset="100%" stopColor="#FF5A00" />
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF07A" />
          <stop offset="100%" stopColor="#FFB800" />
        </linearGradient>
      </defs>
      <g className="streak-flame-body">
        <path
          d="M16 1.5c1.2 5.6 6.1 8.9 9.3 13.6 2.6 3.8 3.7 7.6 3.2 11.6C27.6 34.3 22.4 39 16 39S4.4 34.3 3.5 26.7c-.6-4.6 1-8.9 4.2-12.4.5 2.6 1.8 4.6 3.9 5.6-.6-6.5 1.4-12.4 4.4-18.4z"
          fill={`url(#${id}-outer)`}
        />
        <path
          className="streak-flame-core"
          d="M16.4 18.5c.8 3.3 3.6 5.2 5 8 1.5 3-.2 7.5-5.4 7.5-4.6 0-6.6-3.6-5.6-7 .4-1.4 1.2-2.5 2.3-3.4.2 1.4.9 2.4 2 2.9-.3-3 .4-5.6 1.7-8z"
          fill={`url(#${id}-inner)`}
        />
      </g>
    </svg>
  );
}

const DAY_LABEL: Record<StreakDay["state"], string> = {
  active: "streak kept",
  frozen: "covered by a streak freeze",
  missed: "missed",
  pending: "not yet",
  future: "coming up",
};

function WeekStrip({ days, celebrate = false }: { days: StreakDay[]; celebrate?: boolean }) {
  return (
    <ol className="grid grid-cols-7 gap-1.5">
      {days.map((day, i) => (
        <li
          key={day.key}
          className="flex flex-col items-center gap-1.5"
          aria-label={`${shortDate(day.key)}: ${DAY_LABEL[day.state]}`}
        >
          <span
            aria-hidden="true"
            className={cn(
              "streak-day-letter text-[11px] font-bold",
              day.isToday ? "is-today" : "text-muted-foreground",
            )}
          >
            {day.letter}
          </span>
          <span
            aria-hidden="true"
            style={{ "--i": i } as CSSProperties}
            className={cn(
              "streak-day",
              `is-${day.state}`,
              day.isToday && "is-today",
              celebrate && day.isToday && day.state === "active" && "is-celebrating",
              day.state === "missed" && "bg-muted-foreground/15",
              day.state === "future" && "border-2 border-muted-foreground/20",
            )}
          >
            {day.state === "active" ? (
              <Check strokeWidth={3.5} />
            ) : day.state === "frozen" ? (
              <Snowflake strokeWidth={2.5} />
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

function MilestoneBar({ current }: { current: number }) {
  const next = nextMilestone(current);
  const floor = [...STREAK_MILESTONES].reverse().find((m) => m <= current) ?? 0;
  const progress = Math.max(0.06, (current - floor) / Math.max(1, next - floor));
  const left = next - current;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-semibold text-foreground">
          {left} {left === 1 ? "day" : "days"} to {next}
        </span>
        <span className="text-muted-foreground">Next milestone</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted-foreground/15">
        <div
          className="streak-progress h-full rounded-full"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function FreezeCard({ status }: { status: StreakStatus }) {
  const usedThisMonth =
    !status.freeze_available &&
    status.freeze_used_on !== null &&
    status.freeze_used_on.slice(0, 7) === status.today.slice(0, 7);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-glass-border p-3">
      <span className={cn("streak-ice-tile", usedThisMonth && "is-used")} aria-hidden="true">
        <Snowflake strokeWidth={2.5} />
      </span>
      <div className="min-w-0 text-xs">
        {usedThisMonth ? (
          <>
            <p className="font-semibold text-foreground">
              Freeze used {shortDate(status.freeze_used_on!)}
            </p>
            <p className="text-muted-foreground">
              A new one arrives {shortDate(nextMonthStart(status.today), false)}.
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-foreground">Streak freeze ready</p>
            <p className="text-muted-foreground">
              Miss a day and it saves your streak. One every month.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StreakPanel({ status, name }: { status: StreakStatus; name: string | null }) {
  const counted = status.last_active_on === status.today;
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <StreakFlame lit={counted} className="h-14 w-12 shrink-0" />
        <div>
          <p className="streak-panel-number text-4xl font-extrabold leading-none tabular-nums">
            {status.current}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">day streak</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-foreground">
        {counted
          ? `You're on fire${name ? `, ${name}` : ""}! Open CoursePro tomorrow to make it ${status.current + 1}.`
          : `Open CoursePro today to keep your streak going${name ? `, ${name}` : ""}.`}
      </p>
      <div className="mt-4">
        <WeekStrip days={streakWeek(status)} />
      </div>
      <div className="mt-4">
        <MilestoneBar current={status.current} />
      </div>
      <div className="mt-3">
        <FreezeCard status={status} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Longest streak: {Math.max(status.longest, status.current)}{" "}
        {Math.max(status.longest, status.current) === 1 ? "day" : "days"}
      </p>
    </div>
  );
}

/** The flame and day count in the header; opens this week's streak. */
export function StreakButton({ className }: { className?: string }) {
  const { data } = useStreak();
  const name = useFirstName();
  if (!data) return null;
  const counted = data.last_active_on === data.today;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${data.current} day streak`}
          className={cn(
            "streak-chip glass-hover glass-inset flex h-11 items-center gap-1 rounded-xl px-2.5 sm:px-3",
            className,
          )}
        >
          <StreakFlame lit={counted} className="h-5 w-4" />
          <span className="text-sm font-extrabold tabular-nums">{data.current}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border-glass-border bg-background/95 p-0 shadow-2xl backdrop-blur-xl"
      >
        <StreakPanel status={data} name={name} />
      </PopoverContent>
    </Popover>
  );
}

const SPARKS = Array.from({ length: 16 }, (_, i) => ({
  angle: i * 22.5 + (i % 2) * 9,
  distance: 92 + (i % 3) * 28,
  delay: (i % 4) * 45,
  size: 6 + (i % 3) * 3,
}));

function StreakCelebration({
  status,
  name,
  onClose,
}: {
  status: StreakStatus;
  name: string | null;
  onClose: () => void;
}) {
  const copy = useMemo(() => streakCelebrationCopy(status, name), [status, name]);
  // Rolls from yesterday's number to today's; a new streak rolls up from 0.
  const from = status.lost > 0 ? 0 : status.previous;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Phones that can buzz do, as the flame lands (not iPhone Safari).
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const buzz = reduce ? 0 : window.setTimeout(() => navigator.vibrate?.([24, 70, 36]), 420);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(buzz);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-celebration-title"
      aria-describedby="streak-celebration-line"
      className="streak-celebration"
      onClick={onClose}
    >
      <div className="streak-celebration-glow" aria-hidden="true" />
      <div className="streak-celebration-card" onClick={(e) => e.stopPropagation()}>
        <div className="streak-hero" aria-hidden="true">
          {SPARKS.map((spark, i) => (
            <span
              key={i}
              className="streak-spark"
              style={
                {
                  "--a": `${spark.angle}deg`,
                  "--d": `${spark.distance}px`,
                  "--delay": `${spark.delay}ms`,
                  "--s": `${spark.size}px`,
                } as CSSProperties
              }
            />
          ))}
          {status.froze && (
            <span className="streak-ice-badge">
              <Snowflake strokeWidth={2.5} />
            </span>
          )}
          <StreakFlame lit className="streak-hero-flame" />
        </div>
        <div className="streak-odometer" aria-hidden="true">
          <span className="streak-odometer-roll" data-roll={from !== status.current}>
            <span>{from}</span>
            <span>{status.current}</span>
          </span>
        </div>
        <p className="sr-only">{status.current} day streak.</p>
        <h2 id="streak-celebration-title" className="streak-title">
          {copy.title}
        </h2>
        <p id="streak-celebration-line" className="streak-line">
          {copy.line}
        </p>
        <div className="streak-week">
          <WeekStrip days={streakWeek(status)} celebrate />
        </div>
        <button type="button" autoFocus onClick={onClose} className="streak-continue">
          Keep it going
        </button>
      </div>
    </div>
  );
}

/**
 * The full-screen streak celebration, the first time CoursePro opens each day
 * (after the app has loaded, so it doesn't fight the startup screen).
 */
export function StreakCelebrationLayer({ ready }: { ready: boolean }) {
  const { data } = useStreak();
  const name = useFirstName();
  const storageKey = useScopedKey(CELEBRATED_KEY);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ready || !data?.extended) return;
    try {
      if (localStorage.getItem(storageKey) === data.today) return;
      localStorage.setItem(storageKey, data.today);
    } catch {
      /* storage unavailable: still celebrate once for this load */
    }
    setOpen(true);
  }, [ready, data, storageKey]);

  if (!open || !data || typeof document === "undefined") return null;
  return createPortal(
    <StreakCelebration status={data} name={name} onClose={() => setOpen(false)} />,
    document.body,
  );
}
