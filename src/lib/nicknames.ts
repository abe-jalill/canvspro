import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
  // Done in an effect: writing to a module store during render updated other
  // components mid-render and made class names flicker unpredictably.
  useEffect(() => {
    setNicknameLookup(query.data ?? []);
  }, [query.data]);
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
    // Names update instantly everywhere; rolled back if the save fails.
    onMutate: async (rows: NicknameInput[]) => {
      await qc.cancelQueries({ queryKey: nicknamesQueryKey });
      const previous = qc.getQueryData<ClassNickname[]>(nicknamesQueryKey);
      const next = new Map((previous ?? []).map((n) => [n.canvas_course_id, n]));
      for (const r of rows) {
        const name = r.custom_name.trim();
        if (!name) next.delete(r.canvas_course_id);
        else
          next.set(r.canvas_course_id, {
            canvas_course_id: r.canvas_course_id,
            raw_name: r.raw_name ?? null,
            raw_code: r.raw_code ?? null,
            custom_name: name,
          });
      }
      const optimistic = [...next.values()];
      qc.setQueryData(nicknamesQueryKey, optimistic);
      setNicknameLookup(optimistic);
      return { previous };
    },
    onSuccess: async () => {
      toast.success("Class names updated");
      await qc.invalidateQueries({ queryKey: nicknamesQueryKey });
    },
    onError: (err: Error, _rows, context) => {
      if (context?.previous) {
        qc.setQueryData(nicknamesQueryKey, context.previous);
        setNicknameLookup(context.previous);
      }
      toast.error("Could not save class names", { description: err.message });
    },
  });
}
