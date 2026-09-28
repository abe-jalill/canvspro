import { supabase } from "@/integrations/supabase/client";
import { getUserScope } from "@/lib/user-scope";

type Listener = () => void;

const confirmedByUser = new Map<string, number>();
const listeners = new Set<Listener>();

/**
 * Small external store used by the global key banner. A successful Canvas
 * response can arrive before the deleted preference is refetched, so the UI
 * needs an immediate, in-memory confirmation as well as the database cleanup.
 */
export function getCanvasKeyConfirmedAt(): number {
  return confirmedByUser.get(getUserScope() ?? "") ?? 0;
}

export function subscribeCanvasKeyHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function markCanvasKeyConfirmed(userId: string): void {
  confirmedByUser.set(userId, Date.now());
  listeners.forEach((listener) => listener());
}

/** Removes a stale background-job warning after Canvas has just responded. */
export async function clearCanvasKeyInvalidFlag(): Promise<void> {
  const scope = getUserScope();
  if (!scope) return;
  // The live Canvas response is authoritative for this screen. Do not leave a
  // false warning visible merely because the preference cleanup is delayed.
  markCanvasKeyConfirmed(scope);

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || user.id !== scope || getUserScope() !== scope) return;

  const { error } = await supabase
    .from("user_preferences")
    .delete()
    .eq("user_id", user.id)
    .eq("key", "canvas_key_status");

  if (error) console.warn("Could not clear stale Canvas key status", error.message);
}
