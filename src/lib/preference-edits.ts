/** Acknowledging an older save must never drop a newer edit to the same key. */
export function createPreferenceEdits() {
  const pending = new Map<string, { revision: number; value: unknown }>();
  let revision = 0;
  return {
    set(key: string, value: unknown) {
      pending.set(key, { revision: ++revision, value });
    },
    snapshot() {
      return new Map(pending);
    },
    values() {
      return Object.fromEntries([...pending].map(([key, entry]) => [key, entry.value]));
    },
    acknowledge(saved: Map<string, { revision: number; value: unknown }>) {
      for (const [key, entry] of saved) {
        if (pending.get(key)?.revision === entry.revision) pending.delete(key);
      }
    },
  };
}
