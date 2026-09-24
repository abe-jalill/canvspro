const ALLOWED_ORIGINS = [
  "https://canvaspro.app",
  "https://www.canvaspro.app",
  "capacitor://localhost",
  "ionic://localhost",
  "http://localhost",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";

  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : "https://canvaspro.app";

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "private, no-store",
    Vary: "Origin",
  };
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not signed in" }), {
        status: 401,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const apiKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions` +
        `?select=status,price_id,current_period_end,cancel_at_period_end` +
        `&environment=eq.live` +
        `&order=created_at.desc` +
        `&limit=1`,
      {
        headers: {
          apikey: apiKey,
          Authorization: authHeader,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Could not load subscription");
    }

    const rows = await response.json();
    const subscription = rows?.[0] ?? null;

    return new Response(JSON.stringify(subscription), {
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
    });
  }
});
