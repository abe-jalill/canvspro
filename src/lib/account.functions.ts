import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in account: cancels any live subscription so
 * no further money is taken, removes every row this account owns, then deletes
 * the auth user itself. Row deletion is explicit (not only FK cascade) so a
 * later account can never inherit anything, and it is awaited and checked.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deleted: true }> => {
    const { data: authData, error: authError } = await context.supabase.auth.getUser();
    const userId = authData.user?.id;
    if (authError || !userId || userId !== context.userId) {
      throw new Error("Not signed in");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { ENTITLEMENT_ENV } = await import("@/lib/payments-env.server");

    // 1. Stop billing. Failure here must not block deletion, but is logged.
    try {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_subscription_id, status")
        .eq("user_id", userId)
        .eq("environment", ENTITLEMENT_ENV);
      const cancelable = (subs ?? []).filter((s: any) =>
        ["active", "trialing", "past_due"].includes(String(s.status)),
      );
      if (cancelable.length > 0) {
        const { createStripeClient } = await import("@/lib/stripe.server");
        const stripe = createStripeClient(ENTITLEMENT_ENV);
        for (const sub of cancelable) {
          try {
            await stripe.subscriptions.cancel(String(sub.stripe_subscription_id));
          } catch (error) {
            console.error("Account deletion: cancel failed", sub.stripe_subscription_id, error);
          }
        }
      }
    } catch (error) {
      console.error("Account deletion: subscription cleanup failed", error);
    }

    // 2. Remove owned rows everywhere.
    const tables = [
      "class_nicknames",
      "class_schedule_entries",
      "grade_snapshots",
      "notification_prefs",
      "push_scheduled_alerts",
      "push_sent_log",
      "push_subscriptions",
      "native_push_tokens",
      "subscriptions",
      "user_assignment_meta",
      "user_preferences",
      "user_settings",
    ] as const;
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
    }

    // 3. Delete the auth user last, so a failure above leaves a recoverable state.
    const { error: deleteError } = await (supabaseAdmin.auth as any).admin.deleteUser(userId);
    if (deleteError) throw new Error(deleteError.message ?? "Could not delete the account");

    return { deleted: true };
  });
