import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ClassDay } from "@/lib/class-schedule";
import { DAY_ORDER } from "@/lib/class-schedule";

export const scheduledAssignmentsQueryKey = ["scheduled-assignments"] as const;

export interface ScheduledAssignment {
  id: string;
  assignmentId: number;
  courseId: number | null;
  title: string;
  courseLabel: string;
  dueAt: string;
  htmlUrl: string | null;
  googleEventId: string | null;
}

export interface ScheduleAssignmentInput {
  assignmentId: number;
  courseId: number | null;
  title: string;
  courseLabel: string;
  dueAt: string;
  htmlUrl?: string | null;
}

export async function fetchScheduledAssignments(): Promise<ScheduledAssignment[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("scheduled_assignments")
    .select(
      "id, assignment_id, course_id, title, course_label, due_at, html_url, google_event_id",
    )
    .eq("user_id", user.id)
    .order("due_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: String(r.id),
    assignmentId: Number(r.assignment_id),
    courseId: r.course_id === null ? null : Number(r.course_id),
    title: r.title,
    courseLabel: r.course_label ?? "",
    dueAt: r.due_at,
    htmlUrl: r.html_url ?? null,
    googleEventId: r.google_event_id ?? null,
  }));
}

export function useScheduledAssignments() {
  return useQuery({
    queryKey: scheduledAssignmentsQueryKey,
    queryFn: fetchScheduledAssignments,
    staleTime: 60_000,
  });
}

/** Map of assignment id -> row, so buttons can show an "added" state. */
export function useScheduledAssignmentIds(): Set<number> {
  const { data } = useScheduledAssignments();
  return new Set((data ?? []).map((a) => a.assignmentId));
}

export function useAddAssignmentToSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleAssignmentInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      const { error } = await supabase.from("scheduled_assignments").upsert(
        {
          user_id: user.id,
          assignment_id: input.assignmentId,
          course_id: input.courseId,
          title: input.title,
          course_label: input.courseLabel,
          due_at: input.dueAt,
          html_url: input.htmlUrl ?? null,
        },
        { onConflict: "user_id,assignment_id" },
      );
      if (error) throw new Error(error.message);
      return input;
    },
    onSuccess: async () => {
      toast.success("Added to your class schedule");
      await qc.invalidateQueries({ queryKey: scheduledAssignmentsQueryKey });
    },
    onError: (err: Error) =>
      toast.error("Could not add to your schedule", { description: err.message }),
  });
}

export function useRemoveAssignmentFromSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: number) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      const { error } = await supabase
        .from("scheduled_assignments")
        .delete()
        .eq("user_id", user.id)
        .eq("assignment_id", assignmentId);
      if (error) throw new Error(error.message);
      return assignmentId;
    },
    onSuccess: async () => {
      toast.success("Removed from your class schedule");
      await qc.invalidateQueries({ queryKey: scheduledAssignmentsQueryKey });
    },
    onError: (err: Error) =>
      toast.error("Could not remove it", { description: err.message }),
  });
}

/** Minutes from midnight in the viewer's local timezone. */
export function dueMinutes(dueAt: string): number {
  const d = new Date(dueAt);
  return d.getHours() * 60 + d.getMinutes();
}

/** Weekday letter (M T W R F) for a due date, or null on weekends. */
export function dueClassDay(dueAt: string): ClassDay | null {
  const idx = new Date(dueAt).getDay(); // 0 Sun .. 6 Sat
  if (idx < 1 || idx > 5) return null;
  return DAY_ORDER[idx - 1] ?? null;
}
