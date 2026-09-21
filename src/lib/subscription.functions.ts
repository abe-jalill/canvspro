import { supabase } from "@/integrations/supabase/client";

export type SubscriptionAccess = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
} | null;

export async function getSubscriptionAccess(): Promise<SubscriptionAccess> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const token = session?.access_token;

  if (!token) {
    throw new Error("Not signed in");
  }

  const response = await fetch(
    "https://canvaspro.app/api/mobile/subscription",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ?? `Subscription check failed (${response.status})`,
    );
  }

  return data ?? null;
}
