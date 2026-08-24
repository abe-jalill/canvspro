import type { CourseSummary } from "@/lib/canvas.functions";

export interface CourseGpaEntry {
  courseId: number;
  name: string;
  credits: number;
  score: number | null;
  gpaPoints: number | null;
}

export interface GpaResult {
  gpa: number | null;
  totalCredits: number;
  countedCredits: number;
  weightedPoints: number;
  entries: CourseGpaEntry[];
}

export const DEFAULT_SCALE: Record<number, number> = {
  93: 4.0,
  90: 3.7,
  87: 3.3,
  83: 3.0,
  80: 2.7,
  77: 2.3,
  73: 2.0,
  70: 1.7,
  67: 1.3,
  63: 1.0,
  60: 0.7,
  0: 0.0,
};

export function scoreToGpa(
  score: number | null,
  scale: Record<number, number> = DEFAULT_SCALE,
): number | null {
  if (score == null || Number.isNaN(score)) return null;
  const thresholds = Object.keys(scale)
    .map((k) => Number(k))
    .sort((a, b) => b - a);
  for (const t of thresholds) {
    if (score >= t) return scale[t];
  }
  return 0.0;
}

export function computeGpa(
  courses: CourseSummary[],
  creditsMap: Record<number, number>,
  scale: Record<number, number> = DEFAULT_SCALE,
): GpaResult {
  const entries: CourseGpaEntry[] = [];
  let totalCredits = 0;
  let countedCredits = 0;
  let weightedPoints = 0;

  for (const c of courses) {
    const credits = creditsMap[c.id] ?? 0;
    const gpaPoints = scoreToGpa(c.current_score, scale);
    entries.push({
      courseId: c.id,
      name: c.name,
      credits,
      score: c.current_score,
      gpaPoints,
    });
    totalCredits += credits;
    if (gpaPoints != null && credits > 0) {
      countedCredits += credits;
      weightedPoints += gpaPoints * credits;
    }
  }

  return {
    gpa: countedCredits > 0 ? weightedPoints / countedCredits : null,
    totalCredits,
    countedCredits,
    weightedPoints,
    entries,
  };
}

export function whatIfGpa(
  courses: CourseSummary[],
  creditsMap: Record<number, number>,
  targetGpa: number,
  scale: Record<number, number> = DEFAULT_SCALE,
): number | null {
  const result = computeGpa(courses, creditsMap, scale);
  if (result.countedCredits === 0) return null;

  const remainingCredits = result.totalCredits - result.countedCredits;
  if (remainingCredits <= 0) return null;

  const neededPoints = targetGpa * result.totalCredits - result.weightedPoints;
  return neededPoints / remainingCredits;
}
