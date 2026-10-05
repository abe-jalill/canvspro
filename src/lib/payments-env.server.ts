import type { StripeEnv } from "@/lib/stripe.server";

/**
 * Stripe mode for API calls (checkout, portal). Derived ONLY from this
 * deployment's own configuration — never from client input, because a client
 * that can pick the mode can read/write rows in the other mode.
 *
 * The publishable token is baked in per build: `pk_test_` in preview,
 * `pk_live_` in production.
 */
export function resolveStripeEnv(): StripeEnv {
  const token =
    process.env["VITE_PAYMENTS_CLIENT_TOKEN"] ?? process.env["PAYMENTS_CLIENT_TOKEN"] ?? "";
  if (token.startsWith("pk_live_")) return "live";
  if (token.startsWith("pk_test_")) return "sandbox";
  // Unknown configuration: fail closed toward real payments only.
  return "live";
}

/**
 * Mode that can grant Pro access. Always `live`: test-mode checkouts are free
 * (any 4242 card), so a sandbox row must never unlock paid features anywhere.
 */
export const ENTITLEMENT_ENV: StripeEnv = "live";
