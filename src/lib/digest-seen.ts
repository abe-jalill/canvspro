import type { AssignmentItem } from "./canvas.functions.ts";
import { getCountdown } from "./countdown.ts";

/**
 * Since your last visit, saved to the account so every device agrees: when the
 * student last looked, the grades they had seen, and how urgent each
 * deadline was then. The iPhone app reads and writes the same record.
 */
export const DIGEST_SEEN_KEY = "digest-seen";

export interface DigestSeen {
  /** ISO time of the last visit that counted. */
  lastVisit: string;
  /** Assignment id → the score seen then. */
  grades: Record<string, number>;
  /** Assignment id → its urgency then ("today", "soon", …). */
  urgency: Record<string, string>;
}

/** The record from the account, or null if there is none (or it's malformed). */
export function readDigestSeen(value: unknown): DigestSeen | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<DigestSeen>;
  if (typeof v.lastVisit !== "string" || !Number.isFinite(Date.parse(v.lastVisit))) return null;
  const grades: Record<string, number> = {};
  for (const [id, score] of Object.entries(v.grades ?? {})) {
    if (typeof score === "number" && Number.isFinite(score)) grades[id] = score;
  }
  const urgency: Record<string, string> = {};
  for (const [id, level] of Object.entries(v.urgency ?? {})) {
    if (typeof level === "string") urgency[id] = level;
  }
  return { lastVisit: v.lastVisit, grades, urgency };
}

/** What the student is looking at right now, as the next visit's starting point. */
export function digestSnapshot(
  assignments: Pick<AssignmentItem, "id" | "due_at" | "submission">[],
  now: number,
): DigestSeen {
  const grades: Record<string, number> = {};
  const urgency: Record<string, string> = {};
  for (const a of assignments) {
    const score = a.submission?.score;
    if (typeof score === "number") grades[String(a.id)] = score;
    const countdown = getCountdown(a.due_at);
    if (countdown) urgency[String(a.id)] = countdown.urgency;
  }
  return { lastVisit: new Date(now).toISOString(), grades, urgency };
}

/** True when saving `next` would change nothing but the time. */
export function sameDigest(a: DigestSeen | null, b: DigestSeen): boolean {
  if (!a) return false;
  return (
    JSON.stringify(a.grades) === JSON.stringify(b.grades) &&
    JSON.stringify(a.urgency) === JSON.stringify(b.urgency)
  );
}
