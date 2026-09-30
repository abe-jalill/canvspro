/** Only send a student's Canvas token to a known Canvas host. School vanity
 * domains must be explicitly configured by the operator. */
export function normalizeCanvasDomain(raw: string | null | undefined): string {
  const value = raw?.trim() ?? "";
  if (!value) return "";
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(host)) return "";
    if (host.split(".").some((part) => !part || part.startsWith("-") || part.endsWith("-"))) return "";
    return host;
  } catch {
    return "";
  }
}

export function isAllowedCanvasDomain(domain: string, configured: string[]): boolean {
  if (domain.endsWith(".instructure.com") && domain !== "instructure.com") return true;
  return configured.some((value) => normalizeCanvasDomain(value) === domain);
}
