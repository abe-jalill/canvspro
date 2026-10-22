import { useCallback, useMemo } from "react";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { useSetAssignmentProgress } from "@/hooks/use-assignment-meta";
import {
  ASSIGNMENT_STEPS_KEY,
  newStepId,
  readSteps,
  stepsPercent,
  type AssignmentStep,
} from "@/lib/assignment-steps";

/** Steps for big work, synced to the account; ticking them fills the assignment's progress. */
export function useAssignmentSteps() {
  const saved = useUserPreferenceKey<unknown>(ASSIGNMENT_STEPS_KEY, {});
  const all = useMemo(() => readSteps(saved.value), [saved.value]);
  const setProgress = useSetAssignmentProgress();

  const save = useCallback(
    (assignment: { id: number; course_id: number }, steps: AssignmentStep[]) => {
      const next = { ...all };
      if (steps.length > 0) next[String(assignment.id)] = steps;
      else delete next[String(assignment.id)];
      saved.set(next);
      // Progress follows the steps (cleared when the last step goes).
      setProgress.mutate({
        assignmentId: assignment.id,
        courseId: assignment.course_id,
        percent: steps.length > 0 ? stepsPercent(steps) : null,
      });
    },
    [all, saved, setProgress],
  );

  const stepsFor = useCallback((id: number) => all[String(id)] ?? [], [all]);

  return {
    ready: saved.ready,
    stepsFor,
    save,
    toggle: (a: { id: number; course_id: number }, stepId: string) =>
      save(
        a,
        stepsFor(a.id).map((s) => (s.id === stepId ? { ...s, done: !s.done } : s)),
      ),
    add: (a: { id: number; course_id: number }, title: string) =>
      save(a, [...stepsFor(a.id), { id: newStepId(), title, minutes: null, done: false }]),
    remove: (a: { id: number; course_id: number }, stepId: string) =>
      save(
        a,
        stepsFor(a.id).filter((s) => s.id !== stepId),
      ),
  };
}
