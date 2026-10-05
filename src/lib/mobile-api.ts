const MOBILE_ORIGINS = new Set(["capacitor://localhost", "http://localhost", "https://localhost"]);

export function mobileHeaders(request: Request): Headers {
  const headers = new Headers({ "cache-control": "no-store", Vary: "Origin" });
  const origin = request.headers.get("Origin");
  if (origin && MOBILE_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  return headers;
}

export function mobilePreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: mobileHeaders(request) });
}

export async function handleMobileDeletion(
  request: Request,
  authenticate: (token: string) => Promise<string | null>,
  deleteAccount: (userId: string) => Promise<void>,
): Promise<Response> {
  const headers = mobileHeaders(request);
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (!token) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401, headers });
  const body = await request.json().catch(() => null);
  if (body?.confirm !== "DELETE") {
    return Response.json({ error: "Type DELETE to confirm." }, { status: 400, headers });
  }
  try {
    const userId = await authenticate(token);
    if (!userId) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401, headers });
    await deleteAccount(userId);
    return Response.json({ deleted: true }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("An existing subscription")) {
      return Response.json({ error: message }, { status: 409, headers });
    }
    console.error("[mobile/delete-account]", error);
    return Response.json(
      { error: "Could not delete your account. Please try again." },
      { status: 500, headers },
    );
  }
}
