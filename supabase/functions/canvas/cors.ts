const PRODUCTION_ORIGIN = "https://canvaspro.app";

const ALLOWED_ORIGINS = new Set([
  PRODUCTION_ORIGIN,
  "https://www.canvaspro.app",
  "https://canvaspremium.lovable.app",
  "capacitor://localhost",
  "ionic://localhost",
]);

export function allowedCorsOrigin(origin: string): string {
  if (
    ALLOWED_ORIGINS.has(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/.test(origin) ||
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(origin)
  ) {
    return origin;
  }
  return PRODUCTION_ORIGIN;
}

export function corsHeaders(req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedCorsOrigin(req.headers.get("Origin") ?? ""),
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "private, no-store",
  };
}
