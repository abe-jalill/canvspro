import { useCallback, useEffect, useState } from "react";
import { useScopedKey } from "@/lib/user-scope";

/**
 * The saved JSON under `key`, read during the first render. Reading it in an
 * effect instead left the first render with the default, so a caller's own
 * effect on mount saw "nothing saved" and wrote over what was there.
 */
function readStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// Persisted Map<string, number> — useful for tracking last-seen numeric grades.
export function useLocalNumberMap(baseKey: string) {
  const key = useScopedKey(baseKey);
  const [map, setMap] = useState<Record<string, number>>(() => readStored(key, {}));

  // Another account signing in on this device has its own copy.
  useEffect(() => {
    setMap(readStored(key, {}));
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
  const [map, setMap] = useState<Record<string, string>>(() => readStored(key, {}));

  useEffect(() => {
    setMap(readStored(key, {}));
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
  const [value, setValue] = useState<number>(() => Number(readStored(key, fallback)) || fallback);

  useEffect(() => {
    setValue(Number(readStored(key, fallback)) || fallback);
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
