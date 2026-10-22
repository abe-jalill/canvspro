import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSignOut } from "@/hooks/use-sign-out";

/** How often an open, visible page checks that its sign-in still exists. */
const CHECK_MS = 60_000;

/**
 * Signs this browser out soon after another device ends its sign-in
 * (Settings > Signed-in devices). Only an explicit "no" from the server signs
 * out: a failed check, being offline or an older server leave things alone.
 */
export function useSessionWatch(enabled: boolean) {
  const signOut = useSignOut();
  const latest = useRef(signOut);
  latest.current = signOut;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let signingOut = false;
    const check = async () => {
      if (signingOut || document.visibilityState !== "visible" || !navigator.onLine) return;
      const { data, error } = await supabase.rpc("my_session_active");
      if (cancelled || error || data !== false || signingOut) return;
      signingOut = true;
      await latest.current("You were signed out from another device.");
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const first = window.setTimeout(() => void check(), 5_000);
    const timer = window.setInterval(() => void check(), CHECK_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled]);
}
