export const STUDY_SESSION_STORAGE_KEY = "study-session:active";

export type StudySessionStatus = "running" | "paused";

export interface StudySessionItem {
  id: string;
  name: string;
  source: "canvas" | "manual";
  courseName?: string;
  dueAt?: string | null;
}

export interface StudySessionSnapshot {
  version: 1;
  id: string;
  status: StudySessionStatus;
  items: StudySessionItem[];
  currentIndex: number;
  completedItemIds: string[];
  startedAt: number;
  endsAt: number;
  durationMs: number;
  remainingMs: number;
}

export function remainingForSession(session: StudySessionSnapshot, now = Date.now()) {
  if (session.status === "paused") return Math.max(0, session.remainingMs);
  return Math.max(0, session.endsAt - now);
}

export function isStudySessionSnapshot(value: unknown): value is StudySessionSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudySessionSnapshot>;
  return (
    candidate.version === 1 &&
    typeof candidate.id === "string" &&
    (candidate.status === "running" || candidate.status === "paused") &&
    Array.isArray(candidate.items) &&
    candidate.items.length > 0 &&
    candidate.items.every(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        (item.source === "canvas" || item.source === "manual"),
    ) &&
    typeof candidate.currentIndex === "number" &&
    Array.isArray(candidate.completedItemIds) &&
    candidate.completedItemIds.every((id) => typeof id === "string") &&
    typeof candidate.startedAt === "number" &&
    typeof candidate.endsAt === "number" &&
    typeof candidate.durationMs === "number" &&
    typeof candidate.remainingMs === "number" &&
    candidate.durationMs > 0 &&
    candidate.durationMs <= 480 * 60_000 &&
    candidate.currentIndex >= 0 &&
    candidate.currentIndex < candidate.items.length
  );
}

export function createStudySession(
  items: StudySessionItem[],
  durationMinutes: number,
  now = Date.now(),
): StudySessionSnapshot {
  const durationMs = Math.round(durationMinutes * 60_000);
  return {
    version: 1,
    id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
    status: "running",
    items,
    currentIndex: 0,
    completedItemIds: [],
    startedAt: now,
    endsAt: now + durationMs,
    durationMs,
    remainingMs: durationMs,
  };
}

/** Reserved integration seam for ActivityKit and App Intents. */
export function publishStudySessionSnapshot(session: StudySessionSnapshot | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("canvaspro:study-session", { detail: session }));
}
