const API_VERSION = "/api/v1";

/**
 * Canvas exposes pagination through RFC 5988 Link headers. Only accept a
 * same-school, HTTPS next link under /api/v1 so a malformed upstream header
 * can never turn the proxy into an arbitrary URL fetcher.
 */
export function nextCanvasPagePath(
  linkHeader: string | null,
  canvasDomain: string,
): string | null {
  if (!linkHeader) return null;

  const next = linkHeader
    .split(",")
    .find((part) => /(?:^|;)\s*rel\s*=\s*"?next"?(?:;|$)/i.test(part));
  const href = next?.match(/<([^>]+)>/)?.[1];
  if (!href) return null;

  try {
    const url = new URL(href, `https://${canvasDomain}${API_VERSION}/`);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== canvasDomain.toLowerCase()) {
      return null;
    }
    if (!url.pathname.startsWith(`${API_VERSION}/`)) return null;
    return `${url.pathname.slice(API_VERSION.length)}${url.search}`;
  } catch {
    return null;
  }
}
