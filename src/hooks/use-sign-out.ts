import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { purgeScopedStorage, useUserScope } from "@/lib/user-scope";
import { syncAuthIdentity } from "@/lib/auth-user";
import { forgetBrowserPushForAccount } from "@/lib/push-client";

/**
 * Signs this browser out and leaves nothing of the account behind. Pass a
 * notice to say why (for example, when another device ended this sign-in).
 */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scope = useUserScope();
  return async function signOut(notice?: string) {
    await queryClient.cancelQueries();
    // Stop this browser's notifications for the account while still signed in.
    await forgetBrowserPushForAccount().catch(() => undefined);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      toast.error("Could not sign out", { description: error.message });
      return;
    }
    queryClient.clear();
    purgeScopedStorage(scope);
    syncAuthIdentity(queryClient, null);
    // The cache persister flushes once more after clear(); drop that too so
    // nothing of this account is left behind on the device.
    purgeScopedStorage(scope);
    navigate({ to: "/auth", replace: true });
    if (notice) toast(notice);
  };
}
