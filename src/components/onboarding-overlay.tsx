// One-time animated welcome sequence. Plays over the dashboard on the very
// first sign-in for an account — on any device — then never again. The
// authoritative flag lives on the account (user_settings.seen_onboarding);
// localStorage only mirrors it so a refresh mid-session can't re-trigger it.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { scopedKey, useUserScope } from "@/lib/user-scope";

const FLAG = "onboarding-seen";
const STEP_MS = [5200, 5200, 3600];

function hasSeenLocal(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return true;
  }
}

function markSeenLocal(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

export function OnboardingOverlay() {
  const userId = useUserScope();
  const key = scopedKey(FLAG);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Decide after mount so SSR and hydration match, and only once the account
  // flag has come back — otherwise the overlay would flash for returning users.
  useEffect(() => {
    if (!userId) return;
    if (hasSeenLocal(key)) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("seen_onboarding")
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) return; // can't confirm — stay quiet rather than replay
      if (data?.seen_onboarding) {
        markSeenLocal(key);
        return;
      }
      // Mark seen up front so a refresh or close mid-sequence doesn't replay it.
      markSeenLocal(key);
      void supabase
        .from("user_settings")
        .upsert({ user_id: userId, seen_onboarding: true }, { onConflict: "user_id" });
      setStep(0);
      setLeaving(false);
      setOpen(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [key, userId]);

  function finish() {
    setLeaving(true);
    const t = setTimeout(() => setOpen(false), 700);
    timers.current.push(t);
  }


  useEffect(() => {
    if (!open || leaving) return;
    const t = setTimeout(() => {
      if (step < STEP_MS.length - 1) setStep((s) => s + 1);
      else finish();
    }, STEP_MS[step]);
    timers.current.push(t);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leaving, step]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  // Portalled to <body>: the route wrapper animates (transform), which would
  // otherwise become the containing block for this fixed overlay.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Canvas Pro"
      className={`onboard-scrim fixed inset-0 z-50 flex flex-col ${
        leaving ? "onboard-leave" : "onboard-enter"
      }`}
    >
      <div className="flex items-start justify-end p-4 sm:p-6">
        <button
          type="button"
          onClick={finish}
          className="glass-inset press min-h-11 rounded-full px-4 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"
        >
          Skip
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-4">
        <div className="w-full max-w-lg">
          {step === 0 ? (
            <StepShell
              key="s0"
              headline="Connect your Canvas"
              subtext="Paste your Canvas API key to get started"
            >
              <StepConnect />
            </StepShell>
          ) : null}
          {step === 1 ? (
            <StepShell
              key="s1"
              headline="We organize everything, your way"
              subtext="Classes, assignments, and grades — sorted automatically"
            >
              <StepOrganize />
            </StepShell>
          ) : null}
          {step === 2 ? (
            <StepShell
              key="s2"
              headline="You're all set"
              subtext="Your dashboard is ready"
            >
              <StepReady />
            </StepShell>
          ) : null}
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-2 pb-8"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={STEP_MS.length}
        aria-valuenow={step + 1}
      >
        {STEP_MS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              i === step
                ? "w-8 bg-foreground/70"
                : i < step
                  ? "w-3 bg-foreground/40"
                  : "w-3 bg-foreground/15"
            }`}
          />
        ))}
      </div>
    </div>,
    document.body,
  );
}

function StepShell({
  headline,
  subtext,
  children,
}: {
  headline: string;
  subtext: string;
  children: React.ReactNode;
}) {
  return (
    <section className="onboard-step text-center">
      <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
        {headline}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-muted-foreground sm:text-base">
        {subtext}
      </p>
      <div className="mt-7">{children}</div>
    </section>
  );
}

/* Step 1 — typed API key, then a cursor moves to Save and clicks it. */
function StepConnect() {
  const dots = useMemo(() => "•".repeat(28), []);
  return (
    <div className="glass-panel-strong relative mx-auto w-full max-w-sm p-5 text-left">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Canvas API key
      </p>
      <div className="glass-inset mt-2 flex min-h-11 items-center overflow-hidden rounded-xl px-3">
        <span className="onboard-typed whitespace-nowrap font-mono text-sm tracking-[0.18em] text-foreground">
          {dots}
        </span>
        <span className="onboard-caret ml-0.5 inline-block h-4 w-px bg-foreground/70" />
      </div>
      <div className="mt-4 flex justify-end">
        <span className="onboard-save glass-panel relative inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-xs font-medium uppercase tracking-[0.14em]">
          <span className="onboard-save-label">Save</span>
          <span className="onboard-check" aria-hidden>
            ✓
          </span>
        </span>
      </div>
      <span className="onboard-pointer" aria-hidden />
    </div>
  );
}

/* Step 2 — scattered cards snap into an aligned grid, staggered. */
const MESSY = [
  { label: "PHY1154 · Quiz 4", meta: "due Fri" },
  { label: "BIO 1213 assignment", meta: "82%" },
  { label: "MCS 1424 homework", meta: "due Mon" },
  { label: "HUM 1223 essay", meta: "graded" },
  { label: "BME 1201 lab report", meta: "due Wed" },
  { label: "EGE 1001 project", meta: "94%" },
];

function StepOrganize() {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-2 sm:grid-cols-2">
      {MESSY.map((c, i) => (
        <div
          key={c.label}
          className="onboard-snap glass-panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 text-left"
          style={{ animationDelay: `${i * 140}ms` }}
        >
          <span className="truncate text-xs font-medium">{c.label}</span>
          <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
            {c.meta}
          </span>
        </div>
      ))}
    </div>
  );
}

/* Step 3 — the organized layout zooms toward the live dashboard with a glow. */
function StepReady() {
  return (
    <div className="onboard-arrive relative mx-auto w-full max-w-md">
      <div className="onboard-glow" aria-hidden />
      <div className="glass-panel-strong grid gap-2 rounded-2xl p-4">
        <div className="glass-inset h-8 rounded-xl" />
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-inset h-16 rounded-xl" />
          <div className="glass-inset h-16 rounded-xl" />
          <div className="glass-inset h-16 rounded-xl" />
          <div className="glass-inset h-16 rounded-xl" />
        </div>
      </div>
      <div className="onboard-sparks" aria-hidden>
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} style={{ ["--i" as string]: String(i) }} />
        ))}
      </div>
    </div>
  );
}
