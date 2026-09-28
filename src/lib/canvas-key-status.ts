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

/** Canvas 403 also covers throttling and course permissions, not just tokens. */
export function isCanvasAuthenticationRejected(message: string): boolean {
  if (/rate limit|throttl/i.test(message)) return false;
  if (/Canvas(?: API)? 401\b/i.test(message)) return true;
  return /Canvas(?: API)? 403\b/i.test(message) &&
    /invalid access token|revoked access token|expired access token/i.test(message);
}

export function friendlyCanvasSectionError(raw: string): string {
  if (/rate limit|throttl/i.test(raw)) return "Canvas is busy right now — try again in a moment.";
  if (isCanvasAuthenticationRejected(raw))
    return "Canvas rejected your saved key — add a new one in Settings.";
  if (/Canvas API 403\b/i.test(raw))
    return "Canvas did not allow access to this section. Try refreshing or check your course permissions.";
  if (/Canvas API 404|Failed to fetch|NetworkError|fetch failed/i.test(raw))
    return "Couldn't reach Canvas — check your school's Canvas URL in Settings.";
  return raw;
}

/** An old warning alone is never proof that the current saved key is invalid. */
export function shouldShowCanvasKeyWarning(
  needsVerification: boolean,
  check: { status: "pending" | "error" | "success"; isFetching: boolean; data?: boolean },
): boolean {
  return needsVerification && check.status === "success" && !check.isFetching && check.data === false;
}

/** Empty arrays are valid; only a recorded section failure counts as failure. */
export function canvasBundleHasSuccessfulSection(
  errors: Partial<Record<(typeof CANVAS_SECTIONS)[number], string>> | undefined,
): boolean {
  return CANVAS_SECTIONS.some((key) => !errors?.[key]);
}
