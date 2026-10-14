import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BILLING_REQUIRED_EVENT, type BillingStatus } from "@/lib/billing";

export const billingQueryKey = ["billing", "status"] as const;

/**
 * The signed-in account's billing (`my_billing_status()`). Null while the
 * billing tables aren't deployed yet, which counts as access: the backend
 * decides, and it fails open the same way.
 */
export async function fetchBillingStatus(): Promise<BillingStatus | null> {
  const { data, error } = await supabase.rpc("my_billing_status" as never);
  if (error) {
    // PGRST202: the function doesn't exist yet (migration not applied).
    if (error.code === "PGRST202" || /my_billing_status/.test(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as BillingStatus | null) ?? null;
}

export function useBilling() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: billingQueryKey });
    window.addEventListener(BILLING_REQUIRED_EVENT, refresh);
    return () => window.removeEventListener(BILLING_REQUIRED_EVENT, refresh);
  }, [queryClient]);
  return useQuery({
    queryKey: billingQueryKey,
    queryFn: fetchBillingStatus,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}
