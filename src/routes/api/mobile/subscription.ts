import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
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

  const allowedOrigin = allowedOrigins.includes(origin) ? origin : "https://canvaspro.app";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

async function subscriptionHandler(request: Request) {
  const headers = corsHeaders(request);

  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Not signed in" }, { status: 401, headers });
    }

    const token = authHeader.slice(7);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return Response.json({ error: "Not signed in" }, { status: 401, headers });
    }

    const { ENTITLEMENT_ENV } = await import("@/lib/payments-env.server");

    const body = (await request.json().catch(() => ({}))) as {
      action?: "status" | "checkout" | "portal";
      priceId?: string;
    };
    const action = body.action ?? "status";

    const { data: subscriptions, error } = await supabase
      .from("subscriptions")
      .select(
        "status, price_id, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id",
      )
      .eq("user_id", userId)
      .eq("environment", ENTITLEMENT_ENV)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const grantsAccess = (row: (typeof subscriptions)[number] | null | undefined) => {
      if (!row) return false;
      const periodEnd = row.current_period_end ? new Date(row.current_period_end).getTime() : 0;
      if (row.status === "active" || row.status === "trialing") {
        return !row.current_period_end || periodEnd > Date.now();
      }
      return row.status === "canceled" && periodEnd > Date.now();
    };
    // Prefer a still-valid entitlement over newer historical rows. This keeps
    // website and app access correct even if an account accumulated more than
    // one Stripe subscription before duplicate-checkout protection existed.
    const subscription = subscriptions?.find(grantsAccess) ?? subscriptions?.[0] ?? null;

    if (action === "status") {
      if (!subscription) return Response.json(null, { headers });
      const {
        stripe_customer_id: _customer,
        stripe_subscription_id: _subscription,
        ...access
      } = subscription;
      return Response.json(access, { headers });
    }

    if (action === "checkout") {
      return Response.json(
        { error: "CanvasPro is free for everyone. New subscriptions are unavailable." },
        { status: 410, headers },
      );
    }

    const { createStripeClient } = await import("@/lib/stripe.server");
    const { resolveStripeEnv } = await import("@/lib/payments-env.server");
    const stripe = createStripeClient(resolveStripeEnv());
    const returnUrl = "https://canvaspro.app/mobile-billing-return";

    if (action === "portal") {
      if (!subscription?.stripe_customer_id || !subscription.stripe_subscription_id) {
        return Response.json(
          { error: "No paid subscription found for this account" },
          { status: 404, headers },
        );
      }
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id,
      );
      const customerId =
        typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer.id;
      if (customerId !== subscription.stripe_customer_id) {
        return Response.json({ error: "Subscription account mismatch" }, { status: 403, headers });
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return Response.json({ url: portal.url }, { headers });
    }

    return Response.json({ error: "Invalid billing action" }, { status: 400, headers });
  } catch (error) {
    console.error("Mobile subscription API error:", error);

    const { getStripeErrorMessage } = await import("@/lib/stripe.server");

    return Response.json(
      { error: getStripeErrorMessage(error) },
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

      POST: async ({ request }) => subscriptionHandler(request),
    },
  },
});
