// Server-only billing storage: the billing_accounts row, the launch date and
// the account's free days. Used by the billing actions, the Paddle webhook and
// the reminder job.
import type { SupabaseClient } from "@supabase/supabase-js";
import { LAUNCH_GRACE_DAYS } from "@/lib/billing";

/** The billing tables aren't in the generated types yet. */
export async function billingDb(): Promise<SupabaseClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as SupabaseClient;
}

export interface BillingRow {
  user_id: string;
  paddle_customer_id: string | null;
  paddle_subscription_id: string | null;
  status: string | null;
  plan: "monthly" | "yearly" | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  trial_used: boolean;
  complimentary: boolean;
  last_event_at: string | null;
  trial_reminder_sent_at: string | null;
  renewal_reminder_for: string | null;
  grace_reminder_sent_at: string | null;
}

export async function readBillingRow(userId: string): Promise<BillingRow | null> {
  const db = await billingDb();
  const { data, error } = await db
    .from("billing_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BillingRow | null) ?? null;
}

export async function saveBillingRow(
  userId: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const db = await billingDb();
  const { error } = await db
    .from("billing_accounts")
    .upsert(
      { user_id: userId, ...fields, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
}

export async function readEnforceFrom(): Promise<string | null> {
  const db = await billingDb();
  const { data } = await db.from("billing_config").select("enforce_from").limit(1).maybeSingle();
  return (data?.enforce_from as string | null | undefined) ?? null;
}

/** When an account's free days from launch end; null for accounts made after launch. */
export function graceEndsAt(
  createdAt: string | undefined,
  enforceFrom: string | null,
): string | null {
  if (!createdAt || !enforceFrom) return null;
  const created = Date.parse(createdAt);
  const launch = Date.parse(enforceFrom);
  if (!Number.isFinite(created) || !Number.isFinite(launch) || created >= launch) return null;
  return new Date(launch + LAUNCH_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Before an account is deleted: end any Paddle subscription that could still
 * charge it. Throws if Paddle can't be reached, so the account is kept and
 * deletion can be retried rather than leaving a charging subscription behind.
 */
export async function cancelBillingForDeletion(userId: string): Promise<void> {
  const db = await billingDb();
  const { data, error } = await db
    .from("billing_accounts")
    .select("paddle_subscription_id,status")
    .eq("user_id", userId)
    .maybeSingle();
  // No billing table yet (migration not applied) means nothing to cancel.
  if (error || !data?.paddle_subscription_id) return;
  if (!["trialing", "active", "past_due", "paused"].includes(String(data.status))) return;
  const { cancelImmediately } = await import("@/lib/paddle.server");
  await cancelImmediately(String(data.paddle_subscription_id));
}

export async function accountBasics(
  userId: string,
): Promise<{ email: string | null; createdAt?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error("Account not found");
  return { email: data.user.email ?? null, createdAt: data.user.created_at };
}
