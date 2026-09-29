/**
 * Canvas data should survive an entire study session. Cached results render
 * immediately while stale data refreshes in the background.
 */
export const CANVAS_DATA_STALE_MS = 15 * 60_000;
export const CANVAS_DATA_GC_MS = 6 * 60 * 60_000;
