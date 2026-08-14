import { useCallback, useEffect, useState } from "react";
import { useScopedKey } from "@/lib/user-scope";

// Persisted Map<string, number> — useful for tracking last-seen numeric grades.
export function useLocalNumberMap(baseKey: string) {
  const key = useScopedKey(baseKey);
  const [map, setMap] = useState<Record<string, number>>({});


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setMap(JSON.parse(raw) as Record<string, number>);
    } catch {
      // ignore
    }
  }, [key]);

  const get = useCallback(
    (id: string | number): number | undefined => map[String(id)],
    [map],
  );

  const set = useCallback(
    (id: string | number, value: number) => {
      setMap((prev) => {
        const next = { ...prev, [String(id)]: value };
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [key],
  );

  const setAll = useCallback(
    (values: Record<string, number>) => {
      setMap(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify(values));
        } catch {
          // ignore
        }
        return values;
      });
    },
    [key],
  );

  return { get, set, setAll, ready: true };
}

// Persisted Map<string, string> — used to snapshot prior countdown urgency, etc.
export function useLocalStringMap(baseKey: string) {
  const key = useScopedKey(baseKey);
  const [map, setMap] = useState<Record<string, string>>({});


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setMap(JSON.parse(raw) as Record<string, string>);
    } catch {
      // ignore
    }
  }, [key]);

  const get = useCallback(
    (id: string | number): string | undefined => map[String(id)],
    [map],
  );

  const setAll = useCallback(
    (values: Record<string, string>) => {
      setMap(() => {
        try {
          window.localStorage.setItem(key, JSON.stringify(values));
        } catch {
          // ignore
        }
        return values;
      });
    },
    [key],
  );

  return { get, setAll };
}

// Persisted single number (e.g., last-visit epoch ms).
export function useLocalNumber(baseKey: string, fallback = 0) {
  const key = useScopedKey(baseKey);
  const [value, setValue] = useState<number>(fallback);


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue(Number(raw) || fallback);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const write = useCallback(
    (v: number) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, String(v));
      } catch {
        // ignore
      }
    },
    [key],
  );

  return { value, set: write };
}

export const LAST_SEEN_GRADES_KEY = "canvas:last-seen-grades";
export const LAST_VISIT_KEY = "canvas:last-visit";
export const LAST_COUNTDOWN_KEY = "canvas:last-countdown";
