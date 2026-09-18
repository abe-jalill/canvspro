/**
 * Computes dynamic grade color interpolation:
 * - Scores >= 93% (A) map to vibrant emerald green (hue ~142deg)
 * - Scores <= 63% map to vibrant red (hue ~0deg)
 * - Intermediate scores smoothly transition through orange, amber, and lime.
 */
export function getGradeColor(score: number | null | undefined): string {
  if (score == null || isNaN(score)) return "hsl(215, 15%, 60%)";
  const clamped = Math.min(Math.max(score, 63), 93);
  const ratio = (clamped - 63) / (93 - 63); // 0 at 63%, 1 at 93%
  const hue = Math.round(ratio * 142);
  return `hsl(${hue}, 78%, 52%)`;
}

/**
 * Returns a translucent background glow corresponding to the grade color.
 */
export function getGradeBg(score: number | null | undefined, alpha = 0.12): string {
  if (score == null || isNaN(score)) return "rgba(148, 163, 184, 0.08)";
  const clamped = Math.min(Math.max(score, 63), 93);
  const ratio = (clamped - 63) / (93 - 63);
  const hue = Math.round(ratio * 142);
  return `hsla(${hue}, 78%, 52%, ${alpha})`;
}

/**
 * Derives a standard letter grade if the Canvas LMS course didn't supply one.
 */
export function letterFromScore(score: number | null | undefined): string {
  if (score == null || isNaN(score)) return "—";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}
