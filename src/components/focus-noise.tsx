import { useEffect, useState, useSyncExternalStore } from "react";
import { Slider } from "@/components/ui/slider";
import { useStudySession } from "@/hooks/use-study-session";
import {
  DEFAULT_NOISE,
  noisePlayer,
  readNoisePrefs,
  subscribeNoisePrefs,
  writeNoisePrefs,
  type NoiseKind,
} from "@/lib/focus-noise";
import {
  isBreak,
  isStudySessionSnapshot,
  remainingForSession,
  type StudySessionSnapshot,
} from "@/lib/study-session";
import { cn } from "@/lib/utils";

function useNoisePrefs() {
  return useSyncExternalStore(subscribeNoisePrefs, readNoisePrefs, () => DEFAULT_NOISE);
}

/**
 * Plays the chosen noise while a study session is in focus time, on every
 * signed-in page, so moving around the app doesn't cut the sound. Pausing,
 * breaks, and the end of the session silence it.
 */
export function FocusNoisePlayer() {
  const prefs = useNoisePrefs();
  const { session: restored } = useStudySession();
  const [session, setSession] = useState<StudySessionSnapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSession(restored);
    setNow(Date.now());
  }, [restored]);

  useEffect(() => {
    const changed = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setSession(isStudySessionSnapshot(detail) ? detail : null);
      setNow(Date.now());
    };
    window.addEventListener("canvaspro:study-session", changed);
    return () => window.removeEventListener("canvaspro:study-session", changed);
  }, []);

  const focusing =
    !!session &&
    session.status === "running" &&
    !isBreak(session) &&
    remainingForSession(session, now) > 0;

  // Fall silent when the focus block runs out, even if no page is ticking the timer.
  useEffect(() => {
    if (!focusing || !session) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      remainingForSession(session, Date.now()) + 50,
    );
    return () => window.clearTimeout(timer);
  }, [focusing, session]);

  useEffect(() => {
    if (focusing && prefs.kind !== "off") noisePlayer().set(prefs.kind, prefs.volume);
    else noisePlayer().stop();
  }, [focusing, prefs.kind, prefs.volume]);

  useEffect(() => () => noisePlayer().stop(), []);

  // After a reload mid-session the browser blocks audio until the next tap or key.
  useEffect(() => {
    if (prefs.kind === "off") return;
    const unlock = () => noisePlayer().unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [prefs.kind]);

  return null;
}

const NOISE_OPTIONS: { id: NoiseKind; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "white", label: "White" },
  { id: "brown", label: "Brown" },
];

/** Off / White / Brown and a volume slider. The choice is remembered on this device. */
export function FocusNoiseControls({ className }: { className?: string }) {
  const prefs = useNoisePrefs();
  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div
        role="radiogroup"
        aria-label="Background noise"
        className="flex items-center gap-1 rounded-lg border border-foreground/15 p-1 text-xs"
      >
        <span className="px-2 text-muted-foreground">Noise</span>
        {NOISE_OPTIONS.map((option) => {
          const selected = prefs.kind === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                noisePlayer().unlock();
                writeNoisePrefs({ ...prefs, kind: option.id });
              }}
              className={cn(
                "min-h-8 rounded-md px-3 transition-colors",
                selected
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {prefs.kind !== "off" && (
        <Slider
          aria-label="Noise volume"
          className="w-40"
          min={0}
          max={100}
          step={1}
          value={[Math.round(prefs.volume * 100)]}
          onValueChange={([value]) => writeNoisePrefs({ ...prefs, volume: (value ?? 50) / 100 })}
        />
      )}
    </div>
  );
}
