import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const canvasKeyQueryKey = ["user-settings", "canvas-key"] as const;

/**
 * The Canvas token is write-only from the browser: we only ever ask the
 * backend whether one is saved, never for the value itself.
 *
 * The answer is memoized for a minute so the four Canvas queries don't each
 * pay for an auth round-trip plus an RPC on every page view.
 */
let keyCheck: { at: number; promise: Promise<boolean> } | null = null;
const KEY_CHECK_TTL = 60_000;

export function resetCanvasKeyCheck() {
  keyCheck = null;
}

export async function fetchHasCanvasKey(): Promise<boolean> {
  if (keyCheck && Date.now() - keyCheck.at < KEY_CHECK_TTL) return keyCheck.promise;
  const promise = (async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return false;
    const { data, error } = await supabase.rpc("has_canvas_key");
    if (error) throw new Error(error.message);
    return data === true;
  })();
  keyCheck = { at: Date.now(), promise };
  promise.catch(() => {
    keyCheck = null;
  });
  return promise;
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
      return key;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: canvasKeyQueryKey });
      await qc.invalidateQueries({ queryKey: ["canvas"] });
    },
  });
}
