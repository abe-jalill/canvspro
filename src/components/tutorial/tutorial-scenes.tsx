import type { CSSProperties, ReactNode } from "react";
import { Bell, BookOpen, Check, ListChecks, Megaphone, MousePointer2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import "./tutorial.css";

/**
 * The tutorial's animated scenes: small sketches of each part of the app,
 * drawn with the app's own colors so they match light and dark mode. They are
 * decoration; the step's words say what matters.
 */

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-[19rem] rounded-2xl border border-foreground/10 bg-background/70 p-4 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)] backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Row({
  name,
  meta,
  done = false,
  at,
}: {
  name: string;
  meta: string;
  done?: boolean;
  at: number;
}) {
  return (
    <div className="tut-anim tut-rise flex items-center gap-3 py-2" style={delay(at)}>
      <span
        className={cn(
          "relative grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border text-muted-foreground",
          done && "tut-anim tut-check",
        )}
        style={done ? { ...delay(at) } : undefined}
      >
        {done && (
          <Check
            className="tut-anim tut-tick h-3 w-3 text-background"
            strokeWidth={3}
            style={delay(at)}
          />
        )}
      </span>
      <span
        className={cn("relative min-w-0 flex-1", done && "tut-anim tut-dim")}
        style={done ? delay(at) : undefined}
      >
        <span className="block truncate text-sm font-medium">{name}</span>
        {done && (
          <span
            className="tut-anim tut-strike absolute left-0 top-[0.7rem] h-px w-full bg-foreground/70"
            style={delay(at)}
            aria-hidden="true"
          />
        )}
        <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
      </span>
    </div>
  );
}

export function WelcomeScene() {
  const chips = ["Bio 110", "Calculus", "Writing", "Chemistry"];
  return (
    <div className="relative grid h-56 w-56 place-items-center">
      <div className="tut-anim tut-float grid h-24 w-24 place-items-center rounded-[1.75rem] bg-primary text-2xl font-semibold text-primary-foreground shadow-[0_20px_60px_-20px_var(--tut-accent)]">
        CP
      </div>
      {chips.map((chip, i) => (
        <span
          key={chip}
          className="tut-anim tut-orbit absolute left-1/2 top-1/2 -ml-9 -mt-3 w-[4.5rem] rounded-full border border-foreground/10 bg-background/80 py-1 text-center text-[11px] font-medium shadow-sm"
          style={{ ...delay(-i * 3.5), ["--orbit" as string]: "92px" }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

export function TodoScene() {
  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Today</p>
      <div className="mt-1 divide-y divide-foreground/[0.07]">
        <Row name="Essay draft" meta="College Writing · 11:59 PM" done at={0} />
        <Row name="Lab report" meta="Cell Biology · 5:00 PM" at={0.15} />
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Tomorrow
      </p>
      <div className="mt-1">
        <Row name="Problem set 4" meta="Calculus I · 9:00 AM" at={0.3} />
      </div>
    </Card>
  );
}

export function AddScene() {
  return (
    <Card className="relative h-60 overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">To-Do</p>
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-foreground/15">
          <Plus className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 space-y-2 opacity-40">
        <div className="h-3 w-40 rounded bg-foreground/15" />
        <div className="h-3 w-28 rounded bg-foreground/15" />
      </div>
      <div className="tut-anim tut-sheet absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-foreground/10 bg-background p-3 shadow-[0_-12px_30px_-18px_rgba(0,0,0,0.5)]">
        <p className="text-sm font-semibold">Add a task</p>
        <p className="text-[11px] text-muted-foreground">Is this for a class?</p>
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 rounded-lg border border-foreground/10 p-2 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> For a class
          </div>
          <div className="tut-anim tut-pick relative flex items-center gap-2 rounded-lg border border-foreground/10 p-2 text-xs">
            <ListChecks className="h-3.5 w-3.5" /> Not for a class
            <MousePointer2 className="tut-anim tut-tap absolute right-6 top-3 h-4 w-4 fill-foreground text-background" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function CalendarScene() {
  const rows = [
    {
      time: "9:00 AM",
      end: "9:50",
      name: "Cell Biology",
      meta: "Class · Science Hall 101",
      color: "hsl(205 50% 60%)",
    },
    {
      time: "3:00 PM",
      end: "4:00",
      name: "Study group",
      meta: "Event · Library",
      color: "var(--tut-accent)",
    },
    {
      time: "4:00 PM",
      end: "",
      name: "Lab report",
      meta: "Planned · Cell Biology",
      color: "var(--tut-accent)",
    },
    {
      time: "11:59 PM",
      end: "",
      name: "Essay draft",
      meta: "Due · College Writing",
      color: "hsl(150 50% 55%)",
    },
  ];
  return (
    <Card>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground">{d}</p>
            <p
              className={cn(
                "mx-auto grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold",
                i === 2 && "bg-foreground text-background",
              )}
            >
              {19 + i}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 divide-y divide-foreground/[0.07]">
        {rows.map((r, i) => (
          <div
            key={r.name}
            className="tut-anim tut-rise flex items-start gap-2.5 py-2"
            style={delay(i * 0.35)}
          >
            <div className="w-14 shrink-0 text-right tabular-nums">
              <p className="text-[11px] font-semibold">{r.time}</p>
              {r.end && <p className="text-[10px] text-muted-foreground">{r.end}</p>}
            </div>
            <span
              className="mt-0.5 h-7 w-[3px] rounded-full"
              style={{ backgroundColor: r.color }}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{r.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{r.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function StudyScene() {
  const r = 48;
  const length = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={8}
          />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="var(--tut-accent)"
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={length}
            className="tut-anim tut-ring"
            style={{ ["--ring" as string]: `${length * 0.7}` }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-3xl font-light tabular-nums">25:00</p>
            <p className="text-xs text-muted-foreground">Focus</p>
          </div>
        </div>
      </div>
      <span className="rounded-full border border-foreground/10 bg-background/70 px-3 py-1.5 text-xs font-medium">
        Lab report · Cell Biology
      </span>
    </div>
  );
}

export function GradesScene() {
  const grades = [
    { name: "Cell Biology", score: 0.93 },
    { name: "College Writing", score: 0.95 },
    { name: "Calculus I", score: 0.9 },
  ];
  return (
    <Card className="space-y-3.5">
      {grades.map((g, i) => (
        <div key={g.name}>
          <div className="flex justify-between text-xs font-medium">
            <span>{g.name}</span>
            <span className="tabular-nums">{Math.round(g.score * 100)}%</span>
          </div>
          <div className="mt-1.5 h-1.5 rounded-full bg-foreground/10">
            <div
              className="tut-anim tut-grow h-full rounded-full bg-primary"
              style={{ width: `${g.score * 100}%`, ...delay(i * 0.25) }}
            />
          </div>
        </div>
      ))}
      <div className="tut-anim tut-rise flex items-center gap-2 pt-1 text-xs" style={delay(0.9)}>
        <Megaphone className="h-3.5 w-3.5 text-primary" />
        Quiz moved to Thursday
      </div>
    </Card>
  );
}

export function SyncScene() {
  return (
    <div className="relative flex w-full max-w-[19rem] flex-col items-center gap-5">
      <div className="tut-anim tut-drop w-full rounded-2xl border border-foreground/10 bg-background/85 p-3 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground">
            CP
          </span>
          <div className="min-w-0">
            <p className="flex justify-between text-xs font-semibold">
              CoursePro <span className="font-normal text-muted-foreground">now</span>
            </p>
            <p className="text-xs text-foreground/85">Lab report is due in 2 hours</p>
          </div>
        </div>
      </div>
      <div className="flex items-end gap-4">
        <div className="h-24 w-36 rounded-xl border-2 border-foreground/20 bg-background/60 p-2">
          <div className="h-2 w-16 rounded bg-foreground/15" />
          <div className="mt-2 h-2 w-24 rounded bg-foreground/10" />
        </div>
        <span className="tut-anim tut-pulse mb-9 h-2 w-2 rounded-full bg-primary" />
        <div className="h-24 w-12 rounded-xl border-2 border-foreground/20 bg-background/60 p-1.5">
          <Bell className="mx-auto mt-1 h-3.5 w-3.5 text-primary" />
        </div>
      </div>
    </div>
  );
}
