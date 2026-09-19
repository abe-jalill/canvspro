import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

function paymentsEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Payments are not configured for this build. Complete payments go-live in your Lovable project to enable production checkout.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    paymentsEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  return paymentsEnvironment();
}

export const CANVAS_PRO_PRICE_ID = "pro_monthly";
export const CANVAS_PRO_YEARLY_PRICE_ID = "pro_yearly";
export const CANVAS_PRO_PRICE_LABEL = "$2.99/month";
export const CANVAS_PRO_YEARLY_PRICE_LABEL = "$30/year";
export const CANVAS_PRO_YEARLY_BADGE = "Save 17%!";

export const CANVAS_PRO_PLANS = [
  { id: CANVAS_PRO_PRICE_ID, name: "Monthly", price: "$2.99", cadence: "/month" },
  {
    id: CANVAS_PRO_YEARLY_PRICE_ID,
    name: "Yearly",
    price: "$30",
    cadence: "/year",
    badge: CANVAS_PRO_YEARLY_BADGE,
  },
] as const;

export type CanvasProPlan = (typeof CANVAS_PRO_PLANS)[number];
