import { useCallback, useEffect, useState } from "react";
import { useScopedKey } from "@/lib/user-scope";

export const DASHBOARD_LAYOUT_KEY = "canvas:dashboard-layout";

export type WidgetId =
  | "digest"
  | "focus"
  | "classes"
  | "upcoming"
  | "announcements"
  | "calendar"
  | "heatmap";

export const DEFAULT_ORDER: WidgetId[] = [
  "digest",
  "focus",
  "classes",
  "upcoming",
  "announcements",
  "calendar",
  "heatmap",
];

interface StoredLayout {
  order: WidgetId[];
  hidden: WidgetId[];
}

function normalize(raw: Partial<StoredLayout> | null): StoredLayout {
  const known = new Set(DEFAULT_ORDER);
  const order = (raw?.order ?? []).filter((id): id is WidgetId => known.has(id as WidgetId));
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  const hidden = (raw?.hidden ?? []).filter((id): id is WidgetId => known.has(id as WidgetId));
  return { order, hidden };
}

function read(key: string): StoredLayout {
  if (typeof window === "undefined") return normalize(null);
  try {
    const raw = window.localStorage.getItem(key);
    return normalize(raw ? (JSON.parse(raw) as StoredLayout) : null);
  } catch {
    return normalize(null);
  }
}

function write(key: string, layout: StoredLayout) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(layout));
  } catch {
    // ignore quota errors
  }
}

/** Per-account dashboard widget order + visibility, persisted in the browser. */
export function useDashboardLayout() {
  const key = useScopedKey(DASHBOARD_LAYOUT_KEY);
  const [layout, setLayout] = useState<StoredLayout>(() => normalize(null));

  useEffect(() => {
    setLayout(read(key));
  }, [key]);

  const update = useCallback(
    (fn: (prev: StoredLayout) => StoredLayout) => {
      setLayout((prev) => {
        const next = fn(prev);
        write(key, next);
        return next;
      });
    },
    [key],
  );

  const toggle = useCallback(
    (id: WidgetId) =>
      update((prev) => ({
        ...prev,
        hidden: prev.hidden.includes(id)
          ? prev.hidden.filter((h) => h !== id)
          : [...prev.hidden, id],
      })),
    [update],
  );

  const move = useCallback(
    (id: WidgetId, direction: -1 | 1) =>
      update((prev) => {
        const order = [...prev.order];
        const from = order.indexOf(id);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= order.length) return prev;
        [order[from], order[to]] = [order[to], order[from]];
        return { ...prev, order };
      }),
    [update],
  );

  const reorder = useCallback(
    (id: WidgetId, toIndex: number) =>
      update((prev) => {
        const order = [...prev.order];
        const from = order.indexOf(id);
        if (from < 0 || toIndex < 0 || toIndex >= order.length || from === toIndex)
          return prev;
        order.splice(from, 1);
        order.splice(toIndex, 0, id);
        return { ...prev, order };
      }),
    [update],
  );

  const reset = useCallback(() => update(() => normalize(null)), [update]);

  return {
    order: layout.order,
    hidden: layout.hidden,
    isHidden: (id: WidgetId) => layout.hidden.includes(id),
    toggle,
    move,
    reorder,
    reset,
  };
}
