import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const canvasKeyQueryKey = ["user-settings", "canvas-key"] as const;

export async function fetchCanvasKey(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("user_settings")
    .select("canvas_api_key")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const key = data?.canvas_api_key?.trim();
  return key ? key : null;
}

export function useCanvasKey() {
  return useQuery({
    queryKey: canvasKeyQueryKey,
    queryFn: fetchCanvasKey,
    staleTime: 60_000,
  });
}

export function useSaveCanvasKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string | null) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          canvas_api_key: key && key.trim() ? key.trim() : null,
        },
        { onConflict: "user_id" },
      );
      if (error) throw new Error(error.message);
      return key;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: canvasKeyQueryKey });
      await qc.invalidateQueries({ queryKey: ["canvas"] });
    },
  });
}
