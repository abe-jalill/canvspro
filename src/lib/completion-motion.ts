import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

/**
 * Marking work complete plays a short exit (the check fills, then the row
 * folds away) before the change is saved, so lists don't just jump. While an
 * assignment is "leaving" it shows as done; Undo during that time cancels the
 * save outright.
 */
export const COMPLETION_EXIT_MS = 560;
/** How long the undo bar stays up. */
export const COMPLETION_UNDO_MS = 7000;

type Listener = () => void;
const EMPTY: ReadonlySet<string> = new Set();
let leaving: ReadonlySet<string> = EMPTY;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setLeaving(id: string, on: boolean) {
  const next = new Set(leaving);
  if (on) next.add(id);
  else next.delete(id);
  leaving = next;
  emit();
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Plays the exit, then runs `commit` (the save). `settled` says when the saved
 * state shows the work as done, so the row isn't shown unfinished for a moment
 * while the save is still queued.
 */
export function startCompletionExit(id: string, commit: () => void, settled: () => boolean) {
  if (timers.has(id)) return;
  if (prefersReducedMotion()) {
    commit();
    return;
  }
  setLeaving(id, true);
  timers.set(
    id,
    setTimeout(() => {
      commit();
      let waited = 0;
      const finish = () => {
        if (!timers.has(id)) return;
        if (settled() || waited >= 4000) {
          timers.delete(id);
          setLeaving(id, false);
          return;
        }
        waited += 100;
        timers.set(id, setTimeout(finish, 100));
      };
      timers.set(id, setTimeout(finish, 60));
    }, COMPLETION_EXIT_MS),
  );
}

/** Undo before the save happened: true if it was cancelled in time. */
export function cancelCompletionExit(id: string): boolean {
  const timer = timers.get(id);
  if (!timer || !leaving.has(id)) return false;
  clearTimeout(timer);
  timers.delete(id);
  setLeaving(id, false);
  return true;
}

export function isCompletionSaving(id: string) {
  return leaving.has(id) && timers.has(id);
}

/** Assignment ids playing their completion exit. */
export function useCompletingIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => leaving,
    () => EMPTY,
  );
}

/**
 * Folds a row away while its assignment is completing. If the list keeps
 * finished work (Show finished), the row opens back up once it's saved.
 */
export function useCompletionExit<T extends HTMLElement>(id: string | number) {
  const completing = useCompletingIds().has(String(id));
  const ref = useRef<T>(null);
  const played = useRef(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== "function") return;
    if (completing) {
      played.current = true;
      const height = element.offsetHeight;
      const animation = element.animate(
        [
          { offset: 0, height: `${height}px`, opacity: 1, transform: "none", overflow: "hidden" },
          {
            offset: 0.42,
            height: `${height}px`,
            opacity: 1,
            transform: "none",
            overflow: "hidden",
          },
          {
            offset: 1,
            height: "0px",
            opacity: 0,
            transform: "translateX(14px)",
            overflow: "hidden",
            paddingTop: "0px",
            paddingBottom: "0px",
            marginTop: "0px",
            marginBottom: "0px",
            borderTopWidth: "0px",
            borderBottomWidth: "0px",
          },
        ],
        {
          duration: COMPLETION_EXIT_MS,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
          fill: "forwards",
        },
      );
      return () => animation.cancel();
    }
    if (played.current) {
      // Still listed after saving (or Undo): open back up instead of popping in.
      played.current = false;
      const height = element.offsetHeight;
      element.animate(
        [
          { height: "0px", opacity: 0, overflow: "hidden" },
          { height: `${height}px`, opacity: 1, overflow: "hidden" },
        ],
        { duration: 240, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
      );
    }
  }, [completing]);

  return { ref, completing };
}

// The undo bar: one at a time, for the most recent completion.

export interface CompletionUndo {
  id: string;
  name: string;
  undo: () => void;
  /** Changes on every completion, so the bar restarts its timer. */
  key: number;
}

let undoEntry: CompletionUndo | null = null;
const undoListeners = new Set<Listener>();
let undoKey = 0;

export function showCompletionUndo(entry: Omit<CompletionUndo, "key">) {
  undoEntry = { ...entry, key: ++undoKey };
  for (const listener of undoListeners) listener();
}

export function dismissCompletionUndo(key?: number) {
  if (!undoEntry || (key != null && undoEntry.key !== key)) return;
  undoEntry = null;
  for (const listener of undoListeners) listener();
}

export function useCompletionUndo(): CompletionUndo | null {
  return useSyncExternalStore(
    (listener) => {
      undoListeners.add(listener);
      return () => undoListeners.delete(listener);
    },
    () => undoEntry,
    () => null,
  );
}
