/** Share slow requests until they settle, then briefly reuse successful results. */
export function createRequestCache<T>(ttlMs = 2_000, now = Date.now) {
  let entry: { key: string | null; promise: Promise<T>; pending: boolean; settledAt: number } | undefined;
  return {
    clear() { entry = undefined; },
    get(key: string | null, load: () => Promise<T>): Promise<T> {
      if (entry?.key === key && (entry.pending || now() - entry.settledAt < ttlMs)) return entry.promise;
      const next = { key, promise: undefined as unknown as Promise<T>, pending: true, settledAt: 0 };
      next.promise = Promise.resolve().then(load).then(
        (value) => { next.pending = false; next.settledAt = now(); return value; },
        (error) => { if (entry === next) entry = undefined; throw error; },
      );
      entry = next;
      return next.promise;
    },
  };
}
