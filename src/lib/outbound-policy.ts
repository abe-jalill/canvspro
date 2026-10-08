// Where the server may send requests on a user's behalf. Both values below are
// saved by the browser, so neither can be trusted on its own.

/**
 * Normalizes a user-supplied Canvas URL to a bare hostname, e.g.
 * "https://Yourschool.Instructure.com/" → "yourschool.instructure.com".
 * Returns "" when the value isn't a plausible hostname. Mirrors the edge fn.
 */
export function normalizeCanvasDomain(raw: string | null | undefined): string {
  let v = (raw ?? "").trim().toLowerCase();
  if (!v) return "";
  v = v
    .replace(/^https?:\/\//, "")
    .split("/")[0]!
    .split("?")[0]!
    .trim();
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(v) ? v : "";
}

/**
 * Same rule as the `canvas` edge function (domain-policy.ts): a student's token
 * only goes to a Canvas-hosted school or one the operator configured.
 */
export function isAllowedCanvasHost(domain: string, configured: string[]): boolean {
  if (!domain) return false;
  if (domain.endsWith(".instructure.com") && domain !== "instructure.com") return true;
  return configured.some((value) => normalizeCanvasDomain(value) === domain);
}

/** Browser push services. Any other endpoint is refused rather than letting the
 *  server POST to an arbitrary URL. */
const PUSH_SERVICE_HOSTS = [
  /^web\.push\.apple\.com$/,
  /\.push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /\.notify\.windows\.com$/,
];

export function isPushServiceEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      !url.port &&
      PUSH_SERVICE_HOSTS.some((host) => host.test(url.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

/**
 * A same-site path to return to after sign-in, or null. Resolved the way the
 * browser will: "/\evil.com" and "/\t/evil.com" pass a simple prefix check but
 * become "//evil.com", another site.
 */
export function safeReturnPath(raw: string | null, origin: string): string | null {
  if (!raw || !raw.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}
