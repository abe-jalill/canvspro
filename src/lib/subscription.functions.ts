import { supabase } from "@/integrations/supabase/client";

export type SubscriptionAccess = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
} | null;

export type MobileBillingAction = "checkout" | "portal";

let accessRequest: Promise<SubscriptionAccess> | null = null;

async function authenticatedMobileRequest<T>(body: Record<string, unknown>): Promise<T> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw new Error(sessionError.message);
  if (!session?.access_token) throw new Error("Not signed in");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://canvaspro.app/api/mobile/subscription", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? `Account request failed (${response.status})`);
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("CanvasPro took too long to respond. Check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getSubscriptionAccess(): Promise<SubscriptionAccess> {
  if (accessRequest) return accessRequest;
  accessRequest = authenticatedMobileRequest<SubscriptionAccess>({ action: "status" }).finally(
    () => {
      accessRequest = null;
    },
  );
  return accessRequest;
}

export function resetSubscriptionAccessRequest() {
  accessRequest = null;
}

export async function createMobileBillingUrl(
  action: MobileBillingAction,
  priceId?: string,
): Promise<string> {
  const result = await authenticatedMobileRequest<{ url?: string }>({ action, priceId });
  if (!result.url) throw new Error("Billing did not return a secure URL");
  return result.url;
}
