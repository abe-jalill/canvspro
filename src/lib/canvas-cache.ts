import type { QueryClient } from "@tanstack/react-query";
import { scopedKey } from "@/lib/user-scope";

/**
 * Keeps the last successful Canvas payloads in localStorage so a reload
 * paints instantly from cache while fresh data is fetched in the background.
 */
const STORAGE_KEY = "canvas-cache-v1";
const MAX_AGE_MS = 30 * 60_000;

type Entry = { key: string; at: number; data: unknown };

function storageKey() {
  return scopedKey(STORAGE_KEY);
}

export function hydrateCanvasCache(qc: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return;
    const entries = JSON.parse(raw) as Entry[];
    const now = Date.now();
    for (const e of entries) {
      if (!e || now - e.at > MAX_AGE_MS) continue;
      const key = JSON.parse(e.key) as unknown[];
      if (qc.getQueryData(key) === undefined) {
        qc.setQueryData(key, e.data, { updatedAt: e.at });
      }
    }
  } catch {
    /* ignore corrupt cache */
  }
}

export function persistCanvasCache(qc: QueryClient) {
  if (typeof window === "undefined") return () => {};
  const save = () => {
    try {
      const entries: Entry[] = qc
        .getQueryCache()
        .findAll({ queryKey: ["canvas"] })
        .filter((q) => q.state.status === "success" && q.state.data !== undefined)
        .map((q) => ({
          key: JSON.stringify(q.queryKey),
          at: q.state.dataUpdatedAt,
          data: q.state.data,
        }));
      if (entries.length === 0) return;
      window.localStorage.setItem(storageKey(), JSON.stringify(entries));
    } catch {
      /* quota or serialization issue — cache is best-effort */
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = qc.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(save, 1000);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
