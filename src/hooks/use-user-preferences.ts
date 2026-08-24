import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export const userPreferencesQueryKey = ["user-preferences"] as const;

export async function fetchUserPreferences(): Promise<Record<string, unknown>> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return {};
  const { data, error } = await supabase
    .from("user_preferences")
    .select("key, value")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  const result: Record<string, unknown> = {};
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
  if (!data?.value) return defaultValue;
  return data.value as T;
}

export function useUserPreferences() {
  return useQuery({
    queryKey: userPreferencesQueryKey,
    queryFn: fetchUserPreferences,
    staleTime: 5 * 60_000,
  });
}

export function useSetUserPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      key,
      value,
    }: {
      key: string;
      value: unknown;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("You must be signed in.");
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          key,
          value: value as Database["public"]["Tables"]["user_preferences"]["Insert"]["value"],
        },
        { onConflict: "user_id,key" },
      );
      if (error) throw new Error(error.message);
      return { key, value };
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
  set: (value: T) => void;
} {
  const all = useUserPreferences();
  const set = useSetUserPreference();
  const stored = all.data?.[key];
  const value = stored === undefined ? defaultValue : (stored as T);
  return {
    value,
    isLoading: all.isLoading,
    set: (next) => set.mutate({ key, value: next }),
  };
}
