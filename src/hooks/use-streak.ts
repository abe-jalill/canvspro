import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUserId, userKey } from "@/lib/auth-user";
import { localDateKey, parseStreakStatus, type StreakStatus } from "@/lib/streak";

/**
 * Counts today toward the signed-in student's streak and returns it. Null
 * while the streak table isn't deployed yet, so the streak simply doesn't show.
 */
export async function recordStreakActivity(today = localDateKey()): Promise<StreakStatus | null> {
  const { data, error } = await supabase.rpc(
    "record_streak_activity" as never,
    { p_today: today } as never,
  );
  if (error) {
    // PGRST202: the function doesn't exist yet (migration not applied).
    if (error.code === "PGRST202" || /record_streak_activity/.test(error.message)) return null;
    throw new Error(error.message);
  }
  return parseStreakStatus(data);
}

/**
 * The streak, counted once per local day. A tab left open past midnight counts
 * the new day the next time it's looked at.
 */
export function useStreak() {
  const { userId } = useAuthUserId();
  const [today, setToday] = useState(localDateKey);

  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible") setToday(localDateKey());
    };
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, []);

  return useQuery({
    queryKey: userKey(["streak", today], userId),
    queryFn: () => recordStreakActivity(today),
    enabled: !!userId,
    staleTime: Infinity,
    retry: 1,
  });
}
