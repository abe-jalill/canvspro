import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resetCanvasBundle } from "@/lib/canvas.functions";
import { friendlyCanvasTransportError, invokeCanvasEdge } from "@/lib/canvas-edge-client";
import { isCanvasAuthenticationRejected } from "@/lib/canvas-key-status";
import { clearCanvasKeyInvalidFlag } from "@/lib/canvas-key-health";
import { getUserScope } from "@/lib/user-scope";

export const canvasKeyQueryKey = ["user-settings", "canvas-key"] as const;
export const canvasDomainQueryKey = ["user-settings", "canvas-domain"] as const;
export const canvasKeyValidationQueryKey = ["user-settings", "canvas-key-validation"] as const;

/** A historical warning is only actionable after a fresh check of the token. */
export async function verifySavedCanvasKey(): Promise<boolean> {
  const scope = getUserScope();
  if (!scope) throw new Error("Please sign in to check your Canvas connection.");
  const { data, error } = await invokeCanvasEdge<{ ok?: boolean; error?: string }>({ resource: "validate" });
  if (scope !== getUserScope()) throw new Error("Session changed — please retry.");
  if (error || data?.error) {
    const message = error ? await invokeError(error) : data!.error!;
    if (isCanvasAuthenticationRejected(message)) return false;
    // Offline, expired CanvasPro sessions and service failures cannot prove a
    // Canvas token is invalid. Keep the warning hidden while these recover.
    throw new Error(message);
  }
  if (data?.ok !== true) throw new Error("Could not verify your Canvas connection.");
  void clearCanvasKeyInvalidFlag();
  return true;
}

/**
 * Normalizes a user-supplied Canvas URL to a bare hostname, e.g.
 * "https://Yourschool.Instructure.com/" → "yourschool.instructure.com".
 * Returns "" when the value isn't a plausible hostname. Mirrors the backend.
 */
export function normalizeCanvasDomain(raw: string | null | undefined): string {
  let v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  v = v
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .split("?")[0]!
    .trim();
  if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(v)) return "";
  const labels = v.split(".");
  if (labels.some((label) => !label || label.startsWith("-") || label.endsWith("-"))) return "";
  const forbidden = new Set(["local", "localhost", "internal", "home", "lan"]);
  return labels.some((label) => forbidden.has(label)) ? "" : v;
}

/**
 * The Canvas token is write-only from the browser: we only ever ask the
 * backend whether one is saved, never for the value itself.
 */
export async function fetchHasCanvasKey(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_canvas_key");
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * The Canvas URL is not a secret, so the browser may read it back to prefill
 * the settings form. RLS scopes the row to the signed-in user.
 */
export function useCanvasDomain() {
  return useQuery({
    queryKey: canvasDomainQueryKey,
    queryFn: async (): Promise<string | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("user_settings")
        .select("canvas_domain")
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.canvas_domain as string | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useCanvasKey() {
  return useQuery({
    queryKey: canvasKeyQueryKey,
    queryFn: fetchHasCanvasKey,
    staleTime: 60_000,
  });
}

/** Extracts the real error message from a failed supabase.functions.invoke. */
async function invokeError(err: unknown): Promise<string> {
  const res = (err as { context?: Response }).context;
  if (res && typeof res.text === "function") {
    const body = await res.text().catch(() => "");
    if (body) {
      try {
        const parsed = JSON.parse(body) as { error?: string };
        if (parsed.error) return parsed.error;
      } catch {
        return body.slice(0, 300);
      }
    }
  }
  return friendlyCanvasTransportError(err instanceof Error ? err.message : "Request failed");
}

/** Turns a raw validation failure into a message a student can act on. */
function friendlyValidateError(raw: string): string {
  if (/CANVAS_DOMAIN_NOT_ALLOWED/.test(raw)) {
    return "This school Canvas URL is not enabled yet. Contact support to add it.";
  }
  if (/INVALID_DOMAIN/.test(raw)) {
    return "That Canvas URL doesn't look right — enter it like yourschool.instructure.com.";
  }
  if (/NO_CANVAS_DOMAIN/i.test(raw)) {
    return "Add your school's Canvas URL below the key, then save again.";
  }
  if (/rate limit/i.test(raw)) {
    return "Canvas is busy right now — try saving again in a moment.";
  }
  if (/Canvas API 40[13]/.test(raw)) {
    return "Canvas rejected that key at that URL — double-check both and try again.";
  }
  if (/Canvas API 404|Failed to fetch|NetworkError|fetch failed/i.test(raw)) {
    return "Couldn't reach Canvas at that URL — check the address (it should look like yourschool.instructure.com).";
  }
  return `Canvas check failed: ${raw}`;
}

export interface SaveCanvasInput {
  /** The API key, or null to clear both key and URL. */
  key: string | null;
  /** The school's Canvas URL as typed; normalized before storing. */
  domain: string;
}

export function useSaveCanvasKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCanvasInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      const key = input.key?.trim() ? input.key.trim() : null;
      const domain = normalizeCanvasDomain(input.domain);
      if (key && !domain) {
        throw new Error(
          "Enter your school's Canvas URL (like yourschool.instructure.com) together with the key.",
        );
      }

      // Before saving anything, prove the key actually works at that URL —
      // this runs through the backend, so the browser never calls Canvas
      // directly and the pair can't be saved in a silently broken state.
      if (key) {
        const { data: vData, error: vError } = await invokeCanvasEdge<{ ok?: boolean }>({
          resource: "validate",
          domain,
          token: key,
        });
        if (vError) throw new Error(friendlyValidateError(await invokeError(vError)));
        if (!vData || (vData as { ok?: boolean }).ok !== true) {
          throw new Error(
            "Canvas rejected that key at that URL — double-check both and try again.",
          );
        }
      }

      const { error } = await supabase.from("user_settings").upsert(
        {
          user_id: user.id,
          canvas_api_key: key,
          canvas_domain: key ? domain : null,
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
      toast.success(key ? "Canvas connection saved" : "Canvas key cleared");
      resetCanvasBundle();
      qc.removeQueries({ queryKey: canvasKeyValidationQueryKey });
      await qc.cancelQueries({ queryKey: ["canvas"] });
      if (!key) qc.removeQueries({ queryKey: ["canvas"] });
      qc.setQueryData(canvasKeyQueryKey, !!key);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["user-preferences"] }),
        qc.invalidateQueries({ queryKey: canvasDomainQueryKey }),
        qc.invalidateQueries({ queryKey: ["canvas"] }),
      ]);
    },
    onError: (err: Error) => toast.error("Could not save", { description: err.message }),
  });
}

/** Updates only the Canvas URL, verifying it with the already-saved key. */
export function useSaveCanvasDomain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (raw: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      const domain = normalizeCanvasDomain(raw);
      if (!domain) {
        throw new Error(
          "That Canvas URL doesn't look right — enter it like yourschool.instructure.com.",
        );
      }
      const { data: vData, error: vError } = await invokeCanvasEdge<{ ok?: boolean }>({
        resource: "validate",
        domain,
      });
      if (vError) throw new Error(friendlyValidateError(await invokeError(vError)));
      if (!vData || (vData as { ok?: boolean }).ok !== true) {
        throw new Error(
          "Your saved key doesn't work at that URL — double-check it, or save a new key.",
        );
      }
      const { error } = await supabase
        .from("user_settings")
        .update({ canvas_domain: domain })
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("key", "canvas_key_status");
    },
    onSuccess: async () => {
      toast.success("Canvas URL saved");
      resetCanvasBundle();
      qc.removeQueries({ queryKey: canvasKeyValidationQueryKey });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["user-preferences"] }),
        qc.invalidateQueries({ queryKey: canvasDomainQueryKey }),
        qc.invalidateQueries({ queryKey: ["canvas"] }),
      ]);
    },
    onError: (err: Error) => toast.error("Could not save", { description: err.message }),
  });
}
