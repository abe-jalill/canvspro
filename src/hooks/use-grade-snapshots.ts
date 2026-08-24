import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export interface GradeSnapshot {
  courseId: number;
  score: number;
  recordedAt: Date;
}

export const gradeSnapshotsQueryKey = ["grade-snapshots"] as const;

export async function fetchGradeSnapshots(): Promise<GradeSnapshot[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("grade_snapshots")
    .select("course_id, score, recorded_at")
    .eq("user_id", user.id)
    .order("recorded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    courseId: r.course_id,
    score: r.score,
    recordedAt: new Date(r.recorded_at),
  }));
}

export function useGradeSnapshots() {
  return useQuery({
    queryKey: gradeSnapshotsQueryKey,
    queryFn: fetchGradeSnapshots,
    staleTime: 5 * 60_000,
  });
}

export function useRecordGradeSnapshots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      snapshots: { courseId: number; score: number }[],
    ) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      if (snapshots.length === 0) return;
      const rows = snapshots.map((s) => ({
        user_id: user.id,
        course_id: s.courseId,
        score: s.score,
      })) as Database["public"]["Tables"]["grade_snapshots"]["Insert"][];
      const { error } = await supabase.from("grade_snapshots").insert(rows);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: gradeSnapshotsQueryKey });
    },
  });
}
