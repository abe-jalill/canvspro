import { loadStripe, type Stripe } from "@stripe/stripe-js";

type StripeEnv = "sandbox" | "live";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

function paymentsEnvironment(): StripeEnv | null {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  return null;
}

let stripePromise: Promise<Stripe | null> | null = null;

export function isPaymentsConfigured(): boolean {
  return paymentsEnvironment() !== null;
}

export function getStripe(): Promise<Stripe | null> {
  if (!clientToken) return Promise.resolve(null);
  if (!stripePromise) {
    stripePromise = loadStripe(clientToken);
  }
  return stripePromise;
}

export function getStripeEnvironment(): StripeEnv {
  const env = paymentsEnvironment();
  if (!env) {
    throw new Error(
      "Payments are not configured for this build. Complete payments go-live in your Lovable project to enable production checkout.",
    );
  }
  return env;
}

export const CANVAS_PRO_PRICE_ID = "pro_monthly";
export const CANVAS_PRO_PRICE_LABEL = "$2.99/month";

export type CanvasProPlan = {
  priceId: "pro_monthly" | "pro_yearly";
  label: string;
  price: string;
  cadence: string;
  note?: string;
};

export const CANVAS_PRO_PLANS: CanvasProPlan[] = [
  { priceId: "pro_monthly", label: "Monthly", price: "$2.99", cadence: "per month" },
  {
    priceId: "pro_yearly",
    label: "Yearly",
    price: "$24.99",
    cadence: "per year",
    note: "About 2 months free",
  },
];


