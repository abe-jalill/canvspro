import { useUserPreferenceKey } from "@/hooks/use-user-preferences";

export const ASSIGNMENT_NOTES_KEY = "assignment-notes";

export type AssignmentNotesMap = Record<string, string>;

/**
 * Personal notes on any Canvas assignment, persisted to the account via
 * user_preferences so they follow the user across devices — the same
 * mechanism as estimates and widget layout.
 */
export function useAssignmentNotes() {
  const { value, set, isLoading } = useUserPreferenceKey<AssignmentNotesMap>(
    ASSIGNMENT_NOTES_KEY,
    {},
  );
  const map = value ?? {};
  return {
    isLoading,
    getNote: (assignmentId: number) => map[String(assignmentId)] ?? "",
    setNote: (assignmentId: number, text: string) => {
      const next: AssignmentNotesMap = { ...map };
      const trimmed = text.trim();
      if (trimmed) next[String(assignmentId)] = trimmed;
      else delete next[String(assignmentId)];
      set(next);
    },
  };
}
