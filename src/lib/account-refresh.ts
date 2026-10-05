export const ACCOUNT_REFRESH_INTERVAL_MS = 30_000;
export const ACCOUNT_QUERY_ROOTS = [
  "user-preferences",
  "user-profile",
  "user-settings",
  "class-nicknames",
  "class-schedule-entries",
  "user-assignment-meta",
] as const;

/** Refetch account data even when locally fresh, but never over pending edits. */
export async function refreshAccountQueries(client: {
  isMutating(): number;
  refetchQueries(
    filters: { queryKey: readonly string[]; type: "active" },
    options: { cancelRefetch: boolean },
  ): Promise<unknown>;
}): Promise<void> {
  if (client.isMutating() > 0) return;
  await Promise.allSettled(
    ACCOUNT_QUERY_ROOTS.map((key) =>
      client.refetchQueries({ queryKey: [key], type: "active" }, { cancelRefetch: false }),
    ),
  );
}
