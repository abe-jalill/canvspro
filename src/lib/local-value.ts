import { useCallback, useEffect, useState } from "react";

// Persisted Map<string, number> — useful for tracking last-seen numeric grades.
export function useLocalNumberMap(key: string) {
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

  return { get, set, ready: true };
}

export const LAST_SEEN_GRADES_KEY = "canvas:last-seen-grades";
