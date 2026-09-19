import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuthUserId, userKey } from "@/lib/auth-user";

/** Base key — invalidating this matches every per-user variant. */
export const userPreferencesQueryKey = ["user-preferences"] as const;

type PrefMap = Record<string, unknown>;

export async function fetchUserPreferences(): Promise<PrefMap> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (userError || !user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("user_preferences")
    .select("key, value")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  const result: PrefMap = {};
  (data ?? []).forEach((row) => {
    result[row.key] = row.value;
  });
  return result;
}

export async function getUserPreference<T>(
  key: string,
  defaultValue: T,
): Promise<T> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return defaultValue;
  const { data, error } = await supabase
    .from("user_preferences")
    .select("value")
    .eq("user_id", user.id)
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.value === null || data?.value === undefined) return defaultValue;
  return data.value as T;
}

export function useUserPreferences() {
  const { userId, isPending: authPending } = useAuthUserId();
  const query = useQuery({
    queryKey: userKey(userPreferencesQueryKey, userId),
    enabled: !!userId,
    queryFn: fetchUserPreferences,
    staleTime: 30_000,
    // The database is the source of truth: always revalidate on mount so a
    // warm/persisted cache can never be the basis for a write.
    refetchOnMount: "always",
    retry: 1,
  });
  return {
    ...query,
    // Unknown until we know who is signed in AND the row set has loaded once.
    isLoading: authPending || (!!userId && query.isPending),
    ready: !!userId && query.isSuccess,
  };
}

/**
 * Writes one preference row. The write is awaited, verified, optimistically
 * reflected, and rolled back with a visible error if the database rejects it.
 */
export function useSetUserPreference() {
  const qc = useQueryClient();
  const { userId } = useAuthUserId();
  const key = userKey(userPreferencesQueryKey, userId);

  return useMutation({
    mutationFn: async ({ key: prefKey, value }: { key: string; value: unknown }) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const user = userData.user;
      if (userError || !user) throw new Error("You must be signed in.");
      if (userId && user.id !== userId) throw new Error("Session changed — try again.");
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          key: prefKey,
          value: value as Database["public"]["Tables"]["user_preferences"]["Insert"]["value"],
        },
        { onConflict: "user_id,key" },
      );
      if (error) throw new Error(error.message);
      return { key: prefKey, value };
    },
    onMutate: async ({ key: prefKey, value }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<PrefMap>(key);
      if (previous) qc.setQueryData<PrefMap>(key, { ...previous, [prefKey]: value });
      return { previous };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous);
      toast.error("Could not save that change", { description: err.message });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: userPreferencesQueryKey });
    },
  });
}

export function useUserPreferenceKey<T>(
  key: string,
  defaultValue: T,
): {
  value: T;
  isLoading: boolean;
  /** True once the stored value for this account has actually been read. */
  ready: boolean;
  set: (value: T) => void;
  setAsync: (value: T) => Promise<unknown>;
} {
  const all = useUserPreferences();
  const set = useSetUserPreference();
  const stored = all.data?.[key];
  const value = stored === undefined ? defaultValue : (stored as T);
  return {
    value,
    isLoading: all.isLoading,
    ready: all.ready,
    set: (next) => {
      // Never write a value derived from an unloaded default: that is how
      // saved data used to get wiped on a slow connection.
      if (!all.ready) return;
      set.mutate({ key, value: next });
    },
    setAsync: async (next) => {
      if (!all.ready) throw new Error("Still loading your saved settings.");
      return set.mutateAsync({ key, value: next });
    },
  };
}
