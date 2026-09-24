import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/admin";
import { useAuthUserId, userKey } from "@/lib/auth-user";

/** UI-only check: hides the usage screen from every other account. */
export function useIsAdmin(): { isAdmin: boolean; isPending: boolean } {
  const { userId } = useAuthUserId();
  const query = useQuery({
    queryKey: userKey(["is-admin"], userId),
    enabled: !!userId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return isAdminEmail(data.user?.email);
    },
  });
  return { isAdmin: query.data === true, isPending: query.isPending };
}
