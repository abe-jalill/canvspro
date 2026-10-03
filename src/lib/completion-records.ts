export const COMPLETION_PREFIX = "assignment-completion:";
export interface CompletionRecord {
  completed: boolean;
  completedAt: string | null;
  dueAt: string | null;
  /**
   * Set when someone marks work as not done even though Canvas shows it as
   * submitted. Canvas's status is overridden until a newer submission arrives.
   */
  reopenedAt?: string;
}

export function completionRecords(preferences: Record<string, unknown> = {}) {
  const records: Record<string, CompletionRecord> = {};
  for (const [key, value] of Object.entries(preferences)) {
    if (!key.startsWith(COMPLETION_PREFIX) || !value || typeof value !== "object") continue;
    const row = value as CompletionRecord;
    if (typeof row.completed !== "boolean") continue;
    records[key.slice(COMPLETION_PREFIX.length)] = row;
  }
  return records;
}

/** Assignment id -> when it was reopened (ms), for work marked not done over Canvas. */
export function reopenedAssignmentTimes(preferences: Record<string, unknown> = {}) {
  const times = new Map<string, number>();
  for (const [id, row] of Object.entries(completionRecords(preferences))) {
    if (row.completed || typeof row.reopenedAt !== "string") continue;
    const at = Date.parse(row.reopenedAt);
    if (Number.isFinite(at)) times.set(id, at);
  }
  return times;
}

export function completedAssignmentIds(preferences: Record<string, unknown> = {}) {
  const legacy = preferences["completed-assignments"];
  const ids = new Set<string>(Array.isArray(legacy) ? legacy.filter((id): id is string => typeof id === "string") : []);
  for (const [id, row] of Object.entries(completionRecords(preferences))) {
    if (row.completed) ids.add(id);
    else ids.delete(id);
  }
  return ids;
}
