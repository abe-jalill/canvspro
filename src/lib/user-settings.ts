import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const canvasKeyQueryKey = ["user-settings", "canvas-key"] as const;

/**
 * The Canvas token is write-only from the browser: we only ever ask the
 * backend whether one is saved, never for the value itself.
 */
export async function fetchHasCanvasKey(): Promise<boolean> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data, error } = await supabase.rpc("has_canvas_key");
  if (error) throw new Error(error.message);
  return data === true;
}

export function useCanvasKey() {
  return useQuery({
    queryKey: canvasKeyQueryKey,
    queryFn: fetchHasCanvasKey,
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
      // A newly saved key clears any "Canvas rejected your key" flag the
      // background alert job left behind.
      await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("key", "canvas_key_status");
      return key;
    },
    onSuccess: async (key) => {
      toast.success(key ? "Canvas key saved" : "Canvas key cleared");
      await qc.invalidateQueries({ queryKey: ["user-preferences"] });
      await qc.invalidateQueries({ queryKey: canvasKeyQueryKey });
      await qc.invalidateQueries({ queryKey: ["canvas"] });
    },
    onError: (err: Error) => toast.error("Could not save the key", { description: err.message }),
  });
}
