import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import {
  AddScene,
  CalendarScene,
  GradesScene,
  StudyScene,
  SyncScene,
  TodoScene,
  WelcomeScene,
} from "./tutorial-scenes";

/** Saved once the tour has been opened, so Today stops offering it (on every device). */
export const TUTORIAL_SEEN_KEY = "tutorial-seen";

type TourLink = "/focus" | "/schedule" | "/study-session" | "/grades" | "/settings/notifications";

export interface TourStep {
  title: string;
  body: string;
  Scene: ComponentType;
  link?: { to: TourLink; label: string };
}

/** The same seven steps as the iPhone app's tutorial. */
export const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to CoursePro",
    body: "Your classes, deadlines and grades from Canvas, in one calm place. Here's a one-minute tour.",
    Scene: WelcomeScene,
  },
  {
    title: "See what's due",
    body: "To-Do lists your work day by day, or class by class. Tick something off when it's done and it moves to Completed.",
    Scene: TodoScene,
    link: { to: "/focus", label: "Open To-Do" },
  },
  {
    title: "Add your own tasks",
    body: "Press + on To-Do. Choose whether it's for a class, add the details, and put it on your calendar too if you like.",
    Scene: AddScene,
    link: { to: "/focus", label: "Add a task" },
  },
  {
    title: "Your week on the calendar",
    body: "Class times read from your syllabus, your own events, planned work and due dates, in time order. Add anything with Add event.",
    Scene: CalendarScene,
    link: { to: "/schedule", label: "Open Calendar" },
  },
  {
    title: "Study one thing at a time",
    body: "Pick an assignment and start a focus timer. CoursePro tells you when it's time for a break.",
    Scene: StudyScene,
    link: { to: "/study-session", label: "Start studying" },
  },
  {
    title: "Every class at a glance",
    body: "Grades and announcements from all your classes, side by side.",
    Scene: GradesScene,
    link: { to: "/grades", label: "Open Grades" },
  },
  {
    title: "Stay ahead, everywhere",
    body: "Reminders arrive before things are due, even with the app closed. Everything syncs with the iPhone app, and Settings shows every device you're signed in on.",
    Scene: SyncScene,
    link: { to: "/settings/notifications", label: "Choose reminders" },
  },
];

/**
 * The tour: an animated scene, a few words, and Back / Next. Arrow keys and a
 * swipe on the scene move between steps too. Each step can jump straight to
 * the part of the app it describes.
 */
export function TutorialTour() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const seen = useUserPreferenceKey<unknown>(TUTORIAL_SEEN_KEY, null);
  const touchStart = useRef<number | null>(null);
  const last = TOUR_STEPS.length - 1;
  const current = TOUR_STEPS[step];

  // Opening the tour counts: Today stops suggesting it.
  useEffect(() => {
    if (seen.ready && seen.value !== true) seen.set(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seen.ready, seen.value]);

  const go = useCallback((to: number) => setStep(Math.min(Math.max(to, 0), last)), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") go(step + 1);
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step]);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="CoursePro tutorial"
      className="glass-panel-strong overflow-hidden rounded-[1.75rem] border border-foreground/10"
      style={{ ["--tut-accent" as string]: "hsl(var(--primary))" }}
    >
      {/* The scene. A new step re-mounts it, so its animation starts fresh. */}
      <div
        className="relative grid h-[21rem] place-items-center overflow-hidden bg-gradient-to-b from-primary/15 via-primary/[0.06] to-transparent px-6 py-8"
        onTouchStart={(e) => (touchStart.current = e.touches[0]?.clientX ?? null)}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          const end = e.changedTouches[0]?.clientX;
          touchStart.current = null;
          if (start == null || end == null || Math.abs(end - start) < 40) return;
          go(end < start ? step + 1 : step - 1);
        }}
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
        <div
          key={step}
          className="relative flex w-full justify-center animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
        >
          <current.Scene />
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        <div
          key={step}
          className="min-h-[11rem] sm:min-h-[9.5rem] animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
          aria-live="polite"
        >
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Step {step + 1} of {TOUR_STEPS.length}
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold tracking-tight">{current.title}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {current.body}
          </p>
          {current.link && (
            <Link
              to={current.link.to}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
            >
              {current.link.label}
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(step - 1)}
            disabled={step === 0}
            className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:invisible"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Back</span>
          </button>
          <div className="flex items-center" role="tablist" aria-label="Tutorial steps">
            {TOUR_STEPS.map((s, i) => (
              // A roomy button around a small dot: easy to tap, calm to look at.
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === step}
                aria-label={`Step ${i + 1}: ${s.title}`}
                onClick={() => go(i)}
                className="group grid h-8 min-h-0 place-items-center px-[3px]"
              >
                <span
                  className={cn(
                    "block h-2 rounded-full transition-all duration-300",
                    i === step ? "w-6 bg-primary" : "w-2 bg-foreground/20 group-hover:bg-foreground/35",
                  )}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => (step === last ? void navigate({ to: "/dashboard" }) : go(step + 1))}
            className="press inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            {step === last ? "Get started" : "Next"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
