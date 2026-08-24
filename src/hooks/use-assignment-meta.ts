import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const assignmentMetaQueryKey = ["user-assignment-meta"] as const;

export interface AssignmentMeta {
  assignmentId: number;
  courseId: number;
  estimatedMinutes: number | null;
}

export async function fetchAssignmentMeta(): Promise<AssignmentMeta[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("user_assignment_meta")
    .select("assignment_id, course_id, estimated_minutes")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    assignmentId: Number(r.assignment_id),
    courseId: Number(r.course_id),
    estimatedMinutes: r.estimated_minutes,
  }));
}

export function useAssignmentMeta() {
  return useQuery({
    queryKey: assignmentMetaQueryKey,
    queryFn: fetchAssignmentMeta,
    staleTime: 5 * 60_000,
  });
}

export function useSetAssignmentEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      assignmentId,
      courseId,
      minutes,
    }: {
      assignmentId: number;
      courseId: number;
      minutes: number | null;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      const { error } = await supabase.from("user_assignment_meta").upsert(
        {
          user_id: user.id,
          assignment_id: assignmentId,
          course_id: courseId,
          estimated_minutes: minutes,
        } as Database["public"]["Tables"]["user_assignment_meta"]["Insert"],
        { onConflict: "user_id,assignment_id" },
      );
      if (error) throw new Error(error.message);
      return { assignmentId, minutes };
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: assignmentMetaQueryKey });
    },
  });
}

export function useAssignmentMetaMap(): Map<number, AssignmentMeta> {
  const query = useAssignmentMeta();
  return new Map(
    (query.data ?? []).map((m) => [m.assignmentId, m]),
  );
}
