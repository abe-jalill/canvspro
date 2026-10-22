import { useCallback, useMemo } from "react";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { customAssignmentsForSurface } from "./assignment-sources";

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

export { customToAssignmentItem, NO_CLASS_ID, NO_CLASS_LABEL } from "./assignment-sources.ts";

export function isCustomAssignmentId(id: number) {
  return id < 0;
}

export function useCustomAssignments(includePersonalTasks = false) {
  const { value, isLoading, set, setAsync } = useUserPreferenceKey<CustomAssignment[]>(
    CUSTOM_ASSIGNMENTS_KEY,
    [],
  );

  const all = useMemo(() => readList(value), [value]);
  // A class hidden in Settings hides your own tasks for it too. Saving always
  // writes the whole list, hidden ones included.
  const { value: hidden } = useUserPreferenceKey<number[]>("hidden_course_ids", []);
  const list = useMemo(() => {
    const hiddenIds = new Set(Array.isArray(hidden) ? hidden : []);
    const visible = hiddenIds.size ? all.filter((item) => !hiddenIds.has(item.course_id)) : all;
    return customAssignmentsForSurface(visible, includePersonalTasks);
  }, [all, hidden, includePersonalTasks]);

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
    async (input: {
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
      await setAsync([...all, item]);
      return item;
    },
    [all, setAsync],
  );

  const update = useCallback(
    (id: number, patch: Partial<Omit<CustomAssignment, "id">>) => {
      set(all.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    },
    [all, set],
  );

  const remove = useCallback(
    (id: number) => {
      set(all.filter((item) => item.id !== id));
    },
    [all, set],
  );

  const notesById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of list) if (item.notes) map.set(item.id, item.notes);
    return map;
  }, [list]);

  return { list, byCourse, notesById, add, update, remove, isLoading };
}
