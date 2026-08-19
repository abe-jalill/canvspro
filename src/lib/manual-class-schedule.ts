// User-entered class meeting times, kept per account in the browser.
import { useCallback, useEffect, useState } from "react";
import { useScopedKey } from "@/lib/user-scope";
import {
  DAY_ORDER,
  minutesToLabel,
  type ClassDay,
  type DerivedSession,
} from "@/lib/derive-class-schedule";

export const MANUAL_SCHEDULE_KEY = "canvas:manual-class-schedule";

export interface ManualClass {
  id: string;
  name: string;
  days: ClassDay[];
  /** Minutes from midnight. */
  startMinutes: number;
  endMinutes: number;
  location: string;
}

export function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => Number.parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function minutesToTimeInput(m: number): string {
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function manualToSessions(entries: ManualClass[]): DerivedSession[] {
  return entries
    .filter((e) => e.days.length > 0 && e.endMinutes > e.startMinutes)
    .map((e) => ({
      id: `manual-${e.id}`,
      title: e.name,
      displayName: e.name,
      context: "Added by you",
      location: e.location,
      days: [...e.days].sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)),
      startMinutes: e.startMinutes,
      endMinutes: e.endMinutes,
      timeLabel: `${minutesToLabel(e.startMinutes)} – ${minutesToLabel(e.endMinutes)}`,
      occurrences: 0,
    }));
}

function read(key: string): ManualClass[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as ManualClass[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useManualClasses() {
  const key = useScopedKey(MANUAL_SCHEDULE_KEY);
  const [entries, setEntries] = useState<ManualClass[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(read(key));
    setReady(true);
  }, [key]);

  const persist = useCallback(
    (next: ManualClass[]) => {
      setEntries(next);
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // ignore quota errors
      }
    },
    [key],
  );

  const add = useCallback(
    (entry: Omit<ManualClass, "id">) =>
      persist([
        ...entries,
        { ...entry, id: Math.random().toString(36).slice(2, 10) },
      ]),
    [entries, persist],
  );

  const update = useCallback(
    (id: string, patch: Partial<ManualClass>) =>
      persist(entries.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    [entries, persist],
  );

  const remove = useCallback(
    (id: string) => persist(entries.filter((e) => e.id !== id)),
    [entries, persist],
  );

  return { entries, ready, add, update, remove };
}
