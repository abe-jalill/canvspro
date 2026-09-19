import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { fireBrowserNotification } from "@/lib/notifications";

export interface FocusTimerState {
  open: boolean;
  minimized: boolean;
  assignmentId: number | null;
  name: string;
  /** Planned session length in minutes. */
  plannedMinutes: number;
  remainingMs: number;
  running: boolean;
}

type Listener = () => void;

let state: FocusTimerState = {
  open: false,
  minimized: false,
  assignmentId: null,
  name: "",
  plannedMinutes: 0,
  remainingMs: 0,
  running: false,
};

let endAt: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function set(patch: Partial<FocusTimerState>) {
  state = { ...state, ...patch };
  emit();
}

function stopInterval() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function tick() {
  if (endAt == null) return;
  const remaining = Math.max(0, endAt - Date.now());
  if (remaining <= 0) {
    endAt = null;
    stopInterval();
    set({ remainingMs: 0, running: false });
    const label = state.name || "Study session";
    toast.success("Time's up", { description: `${label} — nice work.` });
    fireBrowserNotification(
      "Time's up",
      `${label} — nice work.`,
      "canvaspro-focus-timer",
    );
    return;
  }
  set({ remainingMs: remaining });
}

function startInterval() {
  stopInterval();
  intervalId = setInterval(tick, 250);
}

export function openTimer(input: {
  assignmentId: number;
  name: string;
  minutes: number;
}) {
  const minutes = Math.max(1, Math.round(input.minutes));
  endAt = null;
  stopInterval();
  set({
    open: true,
    minimized: false,
    assignmentId: input.assignmentId,
    name: input.name,
    plannedMinutes: minutes,
    remainingMs: minutes * 60_000,
    running: false,
  });
}

export function closeTimer() {
  stopInterval();
  endAt = null;
  set({ open: false, running: false });
}

export function toggleMinimize() {
  set({ minimized: !state.minimized });
}

export function toggleRun() {
  if (state.running) {
    // Pause: freeze the remaining time.
    endAt = null;
    stopInterval();
    set({ running: false });
    return;
  }
  if (state.remainingMs <= 0) {
    // Finished — treat as reset-and-start.
    endAt = Date.now() + state.plannedMinutes * 60_000;
  } else {
    endAt = Date.now() + state.remainingMs;
  }
  set({ running: true });
  startInterval();
  tick();
}

export function resetTimer() {
  endAt = null;
  stopInterval();
  set({ remainingMs: state.plannedMinutes * 60_000, running: false });
}

export function addTimerMinutes(extra: number) {
  const planned = state.plannedMinutes + extra;
  const remaining = state.remainingMs + extra * 60_000;
  if (state.running && endAt != null) {
    endAt = endAt + extra * 60_000;
  }
  set({ plannedMinutes: planned, remainingMs: remaining });
}

export function useFocusTimer(): FocusTimerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
