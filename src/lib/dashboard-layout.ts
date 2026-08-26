import { useCallback, useEffect } from "react";
import {
  useUserPreferenceKey,
  useSetUserPreference,
} from "@/hooks/use-user-preferences";

export const DASHBOARD_LAYOUT_KEY = "dashboard-layout";

export type WidgetId =
  | "digest"
  | "focus"
  | "classes"
  | "upcoming"
  | "announcements"
  | "calendar"
  | "heatmap"
  | "gpa";

export const DEFAULT_ORDER: WidgetId[] = [
  "digest",
  "focus",
  "classes",
  "gpa",
  "upcoming",
  "announcements",
  "calendar",
  "heatmap",
];

export type WidgetSize = "sm" | "md" | "full";

interface StoredLayout {
  order: WidgetId[];
  hidden: WidgetId[];
  sizes: Partial<Record<WidgetId, WidgetSize>>;
}

const SIZES: WidgetSize[] = ["sm", "md", "full"];

function normalize(raw: Partial<StoredLayout> | null): StoredLayout {
  const known = new Set(DEFAULT_ORDER);
  const order = (raw?.order ?? []).filter((id): id is WidgetId =>
    known.has(id as WidgetId),
  );
  for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id);
  const hidden = (raw?.hidden ?? []).filter((id): id is WidgetId =>
    known.has(id as WidgetId),
  );
  const sizes: Partial<Record<WidgetId, WidgetSize>> = {};
  for (const [id, size] of Object.entries(raw?.sizes ?? {})) {
    if (known.has(id as WidgetId) && SIZES.includes(size as WidgetSize)) {
      sizes[id as WidgetId] = size as WidgetSize;
    }
  }
  return { order, hidden, sizes };
}

/** Cross-device dashboard widget order + visibility, persisted via user_preferences. */
export function useDashboardLayout() {
  const { value, set } = useUserPreferenceKey<Partial<StoredLayout>>(
    DASHBOARD_LAYOUT_KEY,
    {},
  );
  const layout = normalize(value);

  const update = useCallback(
    (fn: (prev: StoredLayout) => StoredLayout) => {
      const next = fn(layout);
      set(next);
    },
    [layout, set],
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
        if (
          from < 0 ||
          toIndex < 0 ||
          toIndex >= order.length ||
          from === toIndex
        )
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

export function useSaveDashboardLayout() {
  return useSetUserPreference();
}
