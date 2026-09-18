import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Complimentary (comped) Pro access. The list of addresses lives in the
 * server-only COMP_EMAILS secret, so it never ships to the browser.
 */
export const hasCompedAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ comped: boolean }> => {
    const raw = process.env["COMP_EMAILS"] ?? "";
    const allowed = raw
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (allowed.length === 0) return { comped: false };

    const {
      data: { user },
    } = await context.supabase.auth.getUser();
    const email = user?.email?.toLowerCase() ?? "";
    return { comped: email.length > 0 && allowed.includes(email) };
  });
