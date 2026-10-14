// Server-only Paddle Billing API client. Reads PADDLE_API_KEY and the price
// IDs from the environment; never import this from client code.
import type { PaddleSubscription, PriceKey } from "@/lib/billing";

export type PaddleEnvironment = "sandbox" | "production";

export function paddleEnvironment(): PaddleEnvironment {
  return process.env.PADDLE_ENV === "production" ? "production" : "sandbox";
}

const API = {
  sandbox: "https://sandbox-api.paddle.com",
  production: "https://api.paddle.com",
} as const;

const PRICE_ENV: Record<PriceKey, string> = {
  monthly_trial: "PADDLE_PRICE_MONTHLY_TRIAL",
  yearly_trial: "PADDLE_PRICE_YEARLY_TRIAL",
  monthly: "PADDLE_PRICE_MONTHLY",
  yearly: "PADDLE_PRICE_YEARLY",
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function paddlePriceId(key: PriceKey): string {
  return required(PRICE_ENV[key]);
}

export class PaddleError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function paddle<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API[paddleEnvironment()]}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${required("PADDLE_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as {
    data?: T;
    error?: { code?: string; detail?: string };
  } | null;
  if (!response.ok || !json) {
    throw new PaddleError(
      json?.error?.detail ?? `Paddle request failed (${response.status})`,
      response.status,
      json?.error?.code,
    );
  }
  return json.data as T;
}

/** The Paddle customer for an email address, created on first checkout. */
export async function customerIdForEmail(email: string): Promise<string> {
  const found = await paddle<Array<{ id: string }>>(
    "GET",
    `/customers?email=${encodeURIComponent(email)}`,
  );
  if (found[0]?.id) return found[0].id;
  const created = await paddle<{ id: string }>("POST", "/customers", { email });
  return created.id;
}

/** A checkout for one plan, tied to the CanvasPro account that started it. */
export async function createCheckoutTransaction(input: {
  customerId: string;
  priceId: string;
  userId: string;
}): Promise<string> {
  const transaction = await paddle<{ id: string }>("POST", "/transactions", {
    items: [{ price_id: input.priceId, quantity: 1 }],
    customer_id: input.customerId,
    collection_mode: "automatic",
    custom_data: { user_id: input.userId },
  });
  return transaction.id;
}

export function getSubscription(id: string): Promise<PaddleSubscription> {
  return paddle("GET", `/subscriptions/${encodeURIComponent(id)}`);
}

export interface SubscriptionChange {
  items?: Array<{ price_id: string; quantity: number }>;
  proration_billing_mode?: "prorated_immediately" | "do_not_bill" | "full_immediately";
  next_billed_at?: string;
  scheduled_change?: null;
}

export interface ChangePreview {
  immediate_transaction?: {
    details?: { totals?: { grand_total?: string; currency_code?: string } };
  } | null;
}

/** What a change would charge now, for the confirm dialog. */
export function previewSubscriptionChange(
  id: string,
  change: SubscriptionChange,
): Promise<ChangePreview> {
  return paddle("PATCH", `/subscriptions/${encodeURIComponent(id)}/preview`, change);
}

export function updateSubscription(
  id: string,
  change: SubscriptionChange,
): Promise<PaddleSubscription> {
  return paddle("PATCH", `/subscriptions/${encodeURIComponent(id)}`, change);
}

/** Ends the subscription when the current paid (or trial) period ends. */
export function cancelAtPeriodEnd(id: string): Promise<PaddleSubscription> {
  return paddle("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, {
    effective_from: "next_billing_period",
  });
}

/** Ends the subscription now (used when the account is deleted). */
export function cancelImmediately(id: string): Promise<PaddleSubscription> {
  return paddle("POST", `/subscriptions/${encodeURIComponent(id)}/cancel`, {
    effective_from: "immediately",
  });
}

/** Paddle's hosted page for the payment method, invoices and receipts. */
export async function customerPortalUrl(
  customerId: string,
  subscriptionId?: string,
): Promise<string> {
  const session = await paddle<{ urls?: { general?: { overview?: string } } }>(
    "POST",
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    subscriptionId ? { subscription_ids: [subscriptionId] } : {},
  );
  const url = session.urls?.general?.overview;
  if (!url) throw new PaddleError("Paddle returned no portal link", 502);
  return url;
}
