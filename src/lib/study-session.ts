export const STUDY_SESSION_STORAGE_KEY = "study-session:active";

export type StudySessionStatus = "running" | "paused";

export interface StudySessionItem {
  id: string;
  name: string;
  source: "canvas" | "manual";
  courseName?: string;
  dueAt?: string | null;
}

/** Pomodoro: repeating focus blocks separated by short breaks and an occasional long one. */
export interface PomodoroPlan {
  focusMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  /** Every Nth focus block is followed by the long break. */
  roundsBeforeLongBreak: number;
}

export type PomodoroPhase = "focus" | "short-break" | "long-break";

const MINUTE = 60_000;

export const POMODORO_PRESETS = [
  {
    id: "classic",
    label: "25 min focus, 5 min break",
    plan: {
      focusMs: 25 * MINUTE,
      shortBreakMs: 5 * MINUTE,
      longBreakMs: 15 * MINUTE,
      roundsBeforeLongBreak: 4,
    } satisfies PomodoroPlan,
  },
  {
    id: "deep",
    label: "50 min focus, 10 min break",
    plan: {
      focusMs: 50 * MINUTE,
      shortBreakMs: 10 * MINUTE,
      longBreakMs: 30 * MINUTE,
      roundsBeforeLongBreak: 4,
    } satisfies PomodoroPlan,
  },
] as const;

export type PomodoroPresetId = (typeof POMODORO_PRESETS)[number]["id"];

/** What a person can customise, in minutes (and focus blocks), with sensible bounds. */
export const POMODORO_LIMITS = {
  focus: { min: 1, max: 120, fallback: 25 },
  shortBreak: { min: 1, max: 30, fallback: 5 },
  longBreak: { min: 1, max: 60, fallback: 15 },
  rounds: { min: 2, max: 8, fallback: 4 },
} as const;

export interface PomodoroCustomInput {
  focus: unknown;
  shortBreak: unknown;
  longBreak: unknown;
  rounds: unknown;
}

function clampWhole(value: unknown, limit: { min: number; max: number; fallback: number }) {
  // Only real numbers and non-empty text count as input; null, "" and the like
  // would otherwise turn into 0 and get clamped instead of using the default.
  const usable = typeof value === "number" || (typeof value === "string" && value.trim() !== "");
  const parsed = usable ? Number(value) : Number.NaN;
  const whole = Number.isFinite(parsed) ? Math.round(parsed) : limit.fallback;
  return Math.min(limit.max, Math.max(limit.min, whole));
}

/**
 * Turns whatever was typed into a safe plan: whole numbers inside the limits,
 * with empty or invalid fields falling back to the classic 25 / 5 / 15 / 4.
 */
export function buildPomodoroPlan(input: PomodoroCustomInput): PomodoroPlan {
  return {
    focusMs: clampWhole(input.focus, POMODORO_LIMITS.focus) * MINUTE,
    shortBreakMs: clampWhole(input.shortBreak, POMODORO_LIMITS.shortBreak) * MINUTE,
    longBreakMs: clampWhole(input.longBreak, POMODORO_LIMITS.longBreak) * MINUTE,
    roundsBeforeLongBreak: clampWhole(input.rounds, POMODORO_LIMITS.rounds),
  };
}

/**
 * `endsAt`, `durationMs` and `remainingMs` always describe the current block
 * (the whole session for a plain timer, one focus or break block for a
 * pomodoro), so anything that only reads them, such as the iOS Live Activity,
 * keeps working. The pomodoro fields are optional additions.
 */
export interface StudySessionSnapshot {
  version: 1;
  id: string;
  status: StudySessionStatus;
  items: StudySessionItem[];
  currentIndex: number;
  completedItemIds: string[];
  startedAt: number;
  endsAt: number;
  durationMs: number;
  remainingMs: number;
  pomodoro?: PomodoroPlan;
  phase?: PomodoroPhase;
  /** Focus blocks finished so far. */
  round?: number;
}

export function remainingForSession(session: StudySessionSnapshot, now = Date.now()) {
  if (session.status === "paused") return Math.max(0, session.remainingMs);
  return Math.max(0, session.endsAt - now);
}

export function phaseOf(session: StudySessionSnapshot): PomodoroPhase {
  return session.phase ?? "focus";
}

export function isBreak(session: StudySessionSnapshot): boolean {
  return Boolean(session.pomodoro) && phaseOf(session) !== "focus";
}

function phaseLength(plan: PomodoroPlan, phase: PomodoroPhase) {
  if (phase === "focus") return plan.focusMs;
  return phase === "long-break" ? plan.longBreakMs : plan.shortBreakMs;
}

function phaseAfter(ending: PomodoroPhase, round: number, plan: PomodoroPlan): PomodoroPhase {
  if (ending !== "focus") return "focus";
  return (round + 1) % plan.roundsBeforeLongBreak === 0 ? "long-break" : "short-break";
}

/**
 * Moves a running pomodoro on to its next block when the current one has run
 * out. Blocks follow each other from the exact moment the last one ended, so
 * timing never drifts. After a very long absence the current block simply
 * restarts from now instead of replaying every missed block.
 */
export function advanceSession(
  session: StudySessionSnapshot,
  now = Date.now(),
): { session: StudySessionSnapshot; changed: boolean } {
  const plan = session.pomodoro;
  if (!plan || session.status !== "running" || now < session.endsAt) {
    return { session, changed: false };
  }
  let current = session;
  for (let step = 0; step < 24 && now >= current.endsAt; step += 1) {
    const ending = phaseOf(current);
    const round = current.round ?? 0;
    const phase = phaseAfter(ending, round, plan);
    const durationMs = phaseLength(plan, phase);
    current = {
      ...current,
      phase,
      round: ending === "focus" ? round + 1 : round,
      durationMs,
      endsAt: current.endsAt + durationMs,
      remainingMs: durationMs,
    };
  }
  if (now >= current.endsAt) {
    current = { ...current, endsAt: now + current.durationMs, remainingMs: current.durationMs };
  }
  return { session: current, changed: true };
}

/** Ends a break early and starts the next focus block right now. */
export function skipBreak(session: StudySessionSnapshot, now = Date.now()): StudySessionSnapshot {
  const plan = session.pomodoro;
  if (!plan || !isBreak(session)) return session;
  return {
    ...session,
    status: "running",
    phase: "focus",
    durationMs: plan.focusMs,
    endsAt: now + plan.focusMs,
    remainingMs: plan.focusMs,
  };
}

function isValidPlan(value: unknown): value is PomodoroPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<PomodoroPlan>;
  const lengthOk = (ms: unknown) =>
    typeof ms === "number" && Number.isFinite(ms) && ms >= MINUTE && ms <= 480 * MINUTE;
  return (
    lengthOk(plan.focusMs) &&
    lengthOk(plan.shortBreakMs) &&
    lengthOk(plan.longBreakMs) &&
    typeof plan.roundsBeforeLongBreak === "number" &&
    Number.isInteger(plan.roundsBeforeLongBreak) &&
    plan.roundsBeforeLongBreak >= 1 &&
    plan.roundsBeforeLongBreak <= 12
  );
}

export function isStudySessionSnapshot(value: unknown): value is StudySessionSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudySessionSnapshot>;
  return (
    candidate.version === 1 &&
    typeof candidate.id === "string" &&
    (candidate.status === "running" || candidate.status === "paused") &&
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    candidate.items.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        (item.source === "canvas" || item.source === "manual"),
    ) &&
    typeof candidate.currentIndex === "number" &&
    Array.isArray(candidate.completedItemIds) &&
    candidate.completedItemIds.every((id) => typeof id === "string") &&
    typeof candidate.startedAt === "number" &&
    typeof candidate.endsAt === "number" &&
    typeof candidate.durationMs === "number" &&
    typeof candidate.remainingMs === "number" &&
    candidate.durationMs > 0 &&
    candidate.durationMs <= 480 * 60_000 &&
    candidate.currentIndex >= 0 &&
    candidate.currentIndex < candidate.items.length &&
    // Pomodoro fields are optional, but when present they must make sense.
    (candidate.pomodoro === undefined || isValidPlan(candidate.pomodoro)) &&
    (candidate.phase === undefined ||
      candidate.phase === "focus" ||
      candidate.phase === "short-break" ||
      candidate.phase === "long-break") &&
    (candidate.round === undefined ||
      (Number.isInteger(candidate.round) && candidate.round >= 0))
  );
}

export function createStudySession(
  items: StudySessionItem[],
  durationMinutes: number,
  now = Date.now(),
  pomodoro?: PomodoroPlan,
): StudySessionSnapshot {
  const durationMs = pomodoro ? pomodoro.focusMs : Math.round(durationMinutes * 60_000);
  return {
    version: 1,
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    status: "running",
    items,
    currentIndex: 0,
    completedItemIds: [],
    startedAt: now,
    endsAt: now + durationMs,
    durationMs,
    remainingMs: durationMs,
    ...(pomodoro ? { pomodoro, phase: "focus" as const, round: 0 } : {}),
  };
}

/** Reserved integration seam for ActivityKit and App Intents. */
export function publishStudySessionSnapshot(session: StudySessionSnapshot | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("canvaspro:study-session", { detail: session }));
}
