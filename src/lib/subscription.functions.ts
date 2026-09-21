import { supabase } from "@/integrations/supabase/client";

export type SubscriptionAccess = {
  status: string;
  price_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
} | null;

export async function getSubscriptionAccess(): Promise<SubscriptionAccess> {
  const { data, error } = await supabase.functions.invoke(
    "subscription-access",
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data ?? null;
}