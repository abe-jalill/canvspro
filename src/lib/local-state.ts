import { useCallback, useEffect, useState } from "react";
import { useScopedKey } from "@/lib/user-scope";


function read(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function write(key: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // ignore quota errors
  }
}

/** Persisted Set<string> in localStorage. SSR-safe: starts empty, hydrates in effect. */
export function useLocalSet(baseKey: string) {
  const key = useScopedKey(baseKey);
  const [set, setSet] = useState<Set<string>>(() => new Set());


  useEffect(() => {
    setSet(read(key));
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setSet(read(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const has = useCallback((id: string | number) => set.has(String(id)), [set]);

  const add = useCallback(
    (id: string | number) => {
      setSet((prev) => {
        const next = new Set(prev);
        next.add(String(id));
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const remove = useCallback(
    (id: string | number) => {
      setSet((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const toggle = useCallback(
    (id: string | number) => {
      setSet((prev) => {
        const next = new Set(prev);
        const k = String(id);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        write(key, next);
        return next;
      });
    },
    [key],
  );

  return { has, add, remove, toggle, size: set.size };
}

export const DISMISSED_ANNOUNCEMENTS_KEY = "canvas:dismissed-announcements";
export const COMPLETED_ASSIGNMENTS_KEY = "canvas:completed-assignments";
