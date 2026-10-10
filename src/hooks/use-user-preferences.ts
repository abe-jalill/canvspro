import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuthUserId, userKey } from "@/lib/auth-user";
import { createOptimisticWrites } from "@/lib/optimistic-writes";

/** Base key — invalidating this matches every per-user variant. */
export const userPreferencesQueryKey = ["user-preferences"] as const;

export type PrefMap = Record<string, unknown>;
const writes = new WeakMap<object, ReturnType<typeof createOptimisticWrites>>();

export async function fetchUserPreferences(signal?: AbortSignal): Promise<PrefMap> {
  const { data: userData, error: userError } = await supabase.auth.getSession();
  const user = userData.session?.user;
  if (userError || !user) throw new Error("Not signed in");
  let request = supabase
    .from("user_preferences")
    .select("key, value")
    .eq("user_id", user.id);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
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
    queryFn: ({ signal }) => fetchUserPreferences(signal),
    staleTime: 60_000,
    refetchOnMount: false,
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
  const tracker = writes.get(qc) ?? createOptimisticWrites();
  writes.set(qc, tracker);

  return useMutation({
    mutationKey: ["save-preference", userId],
    scope: { id: `preferences:${userId}` },
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
      const ticket = tracker.start(`${userId}:${prefKey}`, previous?.[prefKey]);
      if (previous) qc.setQueryData<PrefMap>(key, { ...previous, [prefKey]: value });
      return ticket;
    },
    onSuccess: (_data, variables, context) => {
      if (context) tracker.commit(context, variables.value);
    },
    onError: (err: Error, _vars, context) => {
      const rollback = context ? tracker.rollback(context) : null;
      if (rollback?.apply) {
        qc.setQueryData<PrefMap>(key, (current) => current ? { ...current, [_vars.key]: rollback.value } : current);
      }
      toast.error("Could not save that change", { description: err.message });
    },
    onSettled: (_data, _error, _variables, context) => {
      if (context) tracker.finish(context);
      // Earlier writes must not refetch over another pending optimistic edit.
      if (qc.isMutating({ mutationKey: ["save-preference", userId] }) === 1) {
        return qc.invalidateQueries({ queryKey: key });
      }
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
  // Skip database writes that would store the exact value already saved.
  const unchanged = (next: T) =>
    stored !== undefined && JSON.stringify(stored) === JSON.stringify(next);
  return {
    value,
    isLoading: all.isLoading,
    ready: all.ready,
    set: (next) => {
      // Never write a value derived from an unloaded default: that is how
      // saved data used to get wiped on a slow connection.
      if (!all.ready || unchanged(next)) return;
      set.mutate({ key, value: next });
    },
    setAsync: async (next) => {
      if (!all.ready) throw new Error("Still loading your saved settings.");
      if (unchanged(next)) return { key, value: next };
      return set.mutateAsync({ key, value: next });
    },
  };
}
