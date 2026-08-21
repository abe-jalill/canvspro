import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { setNicknameLookup } from "@/lib/course-display";

export interface ClassNickname {
  canvas_course_id: number;
  raw_name: string | null;
  raw_code: string | null;
  custom_name: string;
}

export const nicknamesQueryKey = ["class-nicknames"] as const;

export async function fetchNicknames(): Promise<ClassNickname[]> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("class_nicknames")
    .select("canvas_course_id, raw_name, raw_code, custom_name")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    canvas_course_id: Number(r.canvas_course_id),
    raw_name: r.raw_name,
    raw_code: r.raw_code,
    custom_name: r.custom_name,
  }));
}

export function useNicknames() {
  const query = useQuery({
    queryKey: nicknamesQueryKey,
    queryFn: fetchNicknames,
    staleTime: 5 * 60_000,
  });
  // Keep the global display lookup in sync for name-based call sites.
  setNicknameLookup(query.data ?? []);
  return query;
}

export interface NicknameInput {
  canvas_course_id: number;
  raw_name?: string | null;
  raw_code?: string | null;
  custom_name: string;
}

export function useSaveNicknames() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: NicknameInput[]) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");

      const keep = rows.filter((r) => r.custom_name.trim().length > 0);
      const drop = rows.filter((r) => r.custom_name.trim().length === 0);

      if (keep.length > 0) {
        const { error } = await supabase.from("class_nicknames").upsert(
          keep.map((r) => ({
            user_id: user.id,
            canvas_course_id: r.canvas_course_id,
            raw_name: r.raw_name ?? null,
            raw_code: r.raw_code ?? null,
            custom_name: r.custom_name.trim(),
          })),
          { onConflict: "user_id,canvas_course_id" },
        );
        if (error) throw new Error(error.message);
      }
      if (drop.length > 0) {
        const { error } = await supabase
          .from("class_nicknames")
          .delete()
          .eq("user_id", user.id)
          .in(
            "canvas_course_id",
            drop.map((r) => r.canvas_course_id),
          );
        if (error) throw new Error(error.message);
      }
      return keep.length;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: nicknamesQueryKey });
    },
  });
}
