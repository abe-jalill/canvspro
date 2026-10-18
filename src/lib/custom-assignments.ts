import { useCallback, useMemo } from "react";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";

export const CUSTOM_ASSIGNMENTS_KEY = "custom-assignments";

export interface CustomAssignment {
  /** Negative id so it never collides with a Canvas assignment id. */
  id: number;
  course_id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  notes: string;
  created_at: string;
  estimated_minutes?: number | null;
}

function readList(value: unknown): CustomAssignment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is CustomAssignment =>
      Boolean(v) &&
      typeof v === "object" &&
      typeof (v as CustomAssignment).id === "number" &&
      typeof (v as CustomAssignment).course_id === "number" &&
      typeof (v as CustomAssignment).name === "string",
  );
}

export { customToAssignmentItem } from "./assignment-sources.ts";

export function isCustomAssignmentId(id: number) {
  return id < 0;
}

export function useCustomAssignments() {
  const { value, isLoading, set } = useUserPreferenceKey<CustomAssignment[]>(
    CUSTOM_ASSIGNMENTS_KEY,
    [],
  );

  const list = useMemo(() => readList(value), [value]);

  const byCourse = useMemo(() => {
    const map = new Map<number, CustomAssignment[]>();
    for (const item of list) {
      const arr = map.get(item.course_id) ?? [];
      arr.push(item);
      map.set(item.course_id, arr);
    }
    return map;
  }, [list]);

  const add = useCallback(
    (input: {
      course_id: number;
      name: string;
      due_at: string | null;
      points_possible: number | null;
      notes: string;
      estimated_minutes?: number | null;
    }) => {
      const item: CustomAssignment = {
        ...input,
        id: -Date.now(),
        created_at: new Date().toISOString(),
      };
      set([...list, item]);
      return item;
    },
    [list, set],
  );

  const update = useCallback(
    (id: number, patch: Partial<Omit<CustomAssignment, "id">>) => {
      set(list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [list, set],
  );

  const remove = useCallback(
    (id: number) => {
      set(list.filter((item) => item.id !== id));
    },
    [list, set],
  );

  const notesById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of list) if (item.notes) map.set(item.id, item.notes);
    return map;
  }, [list]);

  return { list, byCourse, notesById, add, update, remove, isLoading };
}
