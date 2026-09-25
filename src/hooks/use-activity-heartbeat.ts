import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useScopedKey } from "@/lib/user-scope";

const THROTTLE_MS = 20 * 60_000; // at most one ping per 20 minutes per device
const STORAGE_KEY = "canvas:last-activity-ping";

function lastPing(storageKey: string): number {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

async function ping(storageKey: string): Promise<void> {
  if (Date.now() - lastPing(storageKey) < THROTTLE_MS) return;
  // Optimistically stamp first so concurrent tabs don't double-fire.
  try {
    localStorage.setItem(storageKey, String(Date.now()));
  } catch {
    /* storage unavailable — still attempt the ping */
  }
  const { error } = await supabase.rpc("record_activity_heartbeat");
  if (error) {
    // Let the next opportunity retry rather than swallowing the day silently.
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }
}

/** Records that this account used the app today. Silent, throttled, non-blocking. */
export function useActivityHeartbeat(enabled: boolean): void {
  const storageKey = useScopedKey(STORAGE_KEY);

  useEffect(() => {
    if (!enabled) return;
    void ping(storageKey);

    function onVisible() {
      if (document.visibilityState === "visible") void ping(storageKey);
    }
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(() => void ping(storageKey), THROTTLE_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, storageKey]);
}
