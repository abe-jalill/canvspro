import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionAccess = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_subscription_id: string;
} | null;

let accessRequest: Promise<SubscriptionAccess> | null = null;

/**
 * Reads billing status through the authenticated mobile API. Native builds
 * must use the production origin because their UI is served from the bundled
 * Capacitor origin; browsers keep the request same-origin for local preview.
 */
export function getSubscriptionAccess(): Promise<SubscriptionAccess> {
  if (accessRequest) return accessRequest;

  accessRequest = (async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!data.session?.access_token) throw new Error("Not signed in");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const endpoint = Capacitor.isNativePlatform()
        ? "https://canvaspro.app/api/mobile/subscription"
        : "/api/mobile/subscription";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "status" }),
        signal: controller.signal,
      });
      const result = (await response.json().catch(() => null)) as
        SubscriptionAccess | { error?: string };
      if (!response.ok) {
        throw new Error(
          result && typeof result === "object" && "error" in result && result.error
            ? result.error
            : `Account request failed (${response.status})`,
        );
      }
      return result as SubscriptionAccess;
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") {
        throw new Error("CanvasPro took too long to respond.");
      }
      throw requestError;
    } finally {
      window.clearTimeout(timeout);
    }
  })().finally(() => {
    accessRequest = null;
  });

  return accessRequest;
}
