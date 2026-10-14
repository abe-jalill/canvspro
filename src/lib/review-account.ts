// App Review's sign-in. Apple's reviewers have no Canvas account, so this one
// real CanvasPro account sees the built-in sample student's coursework instead
// of connecting to a school (the iOS app does the same: NativeReviewAccount).

export const REVIEW_ACCOUNT_EMAIL = "appreview@canvaspro.app";

export function isReviewAccount(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === REVIEW_ACCOUNT_EMAIL;
}

/**
 * The email in a signed-in request's access token ("Bearer <jwt>"). Null for
 * the publishable key, signed-out requests and anything unreadable. Only used
 * to choose what the browser shows; the backend still checks every token.
 */
export function emailFromAuthorization(header: string | null | undefined): string | null {
  const payload = header?.match(/^Bearer\s+([^.\s]+)\.([^.\s]+)\./i)?.[2];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    const email = (claims as { email?: unknown } | null)?.email;
    return typeof email === "string" ? email : null;
  } catch {
    return null;
  }
}
