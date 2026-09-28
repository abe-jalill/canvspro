/** A newer foreground Canvas success supersedes an older background rejection. */
export function isCanvasKeyWarningCurrent(
  warningAt: string | undefined,
  confirmedAt: number,
): boolean {
  const parsed = warningAt ? Date.parse(warningAt) : Number.NaN;
  const warningTime = Number.isFinite(parsed) ? parsed : 0;
  return confirmedAt <= warningTime;
}

const CANVAS_SECTIONS = ["courses", "assignments", "announcements", "calendar"] as const;

/** Empty arrays are valid; only a recorded section failure counts as failure. */
export function canvasBundleHasSuccessfulSection(
  errors: Partial<Record<(typeof CANVAS_SECTIONS)[number], string>> | undefined,
): boolean {
  return CANVAS_SECTIONS.some((key) => !errors?.[key]);
}
