import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Permanently deletes the signed-in account (see account-deletion.server.ts). */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deleted: true }> => {
    const { data: authData, error: authError } = await context.supabase.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId || userId !== context.userId) {
      throw new Error("Not signed in");
    }

    const { deleteAccountData } = await import("@/lib/account-deletion.server");
    await deleteAccountData(userId);
    return { deleted: true };
  });
