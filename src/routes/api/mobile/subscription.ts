import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request
        ? input.headers
        : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) =>
        headers.set(key, value),
      );
    }

    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);

    return fetch(input, {
      ...init,
      headers,
    });
  };
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";

  const allowedOrigins = [
    "capacitor://localhost",
    "ionic://localhost",
    "https://canvaspro.app",
    "https://www.canvaspro.app",
  ];

  const allowedOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://canvaspro.app";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function subscriptionHandler(request: Request) {
  const headers = corsHeaders(request);

  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Not signed in" },
        { status: 401, headers },
      );
    }

    const token = authHeader.slice(7);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY =
      process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        global: {
          fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);

    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return Response.json(
        { error: "Not signed in" },
        { status: 401, headers },
      );
    }

    const { ENTITLEMENT_ENV } =
      await import("@/lib/payments-env.server");

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select(
        "status, price_id, current_period_end, cancel_at_period_end",
      )
      .eq("user_id", userId)
      .eq("environment", ENTITLEMENT_ENV)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return Response.json(subscription ?? null, {
      headers,
    });
  } catch (error) {
    console.error("Mobile subscription API error:", error);

    return Response.json(
      { error: "Unable to load subscription" },
      {
        status: 500,
        headers,
      },
    );
  }
}

export const Route = createFileRoute("/api/mobile/subscription")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, {
          headers: corsHeaders(request),
        }),

      POST: async ({ request }) =>
        subscriptionHandler(request),
    },
  },
});
