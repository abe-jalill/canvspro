/**
 * Permanently deletes an account: removes every row it owns, its profile
 * pictures, then the auth user itself. Row deletion is explicit (not only FK
 * cascade) so a later account can never inherit anything, and every step is
 * awaited and checked. Shared by the website and the iOS app so both remove
 * exactly the same data.
 */
export async function deleteAccountData(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Deleting the database row does not cancel a subscription at Stripe.
  // Never orphan a renewal by removing its owner and billing identifiers.
  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .select("status,cancel_at_period_end,environment")
    .eq("user_id", userId);
  if (subscriptionError) throw new Error("Could not check existing subscriptions. Please try again.");
  if (subscriptions?.some((subscription) =>
    subscription.environment === "live" &&
    !subscription.cancel_at_period_end &&
    ["active", "trialing", "past_due", "unpaid"].includes(subscription.status)
  )) {
    throw new Error("An existing subscription may still renew. Cancel it through billing or contact support@canvaspro.app before deleting your account.");
  }

  const tables = [
    "account_profiles",
    "class_nicknames",
    "class_schedule_entries",
    "grade_snapshots",
    "notification_prefs",
    "push_scheduled_alerts",
    "push_sent_log",
    "push_subscriptions",
    "subscriptions",
    "user_assignment_meta",
    "user_activity_daily",
    "user_preferences",
    "user_settings",
  ] as const;
  for (const table of tables) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
  }

  const { data: avatarFiles, error: avatarListError } = await supabaseAdmin.storage
    .from("profile-avatars")
    .list(userId);
  if (avatarListError && avatarListError.message !== "Bucket not found") {
    throw new Error(`Could not inspect profile pictures: ${avatarListError.message}`);
  }
  if (avatarFiles?.length) {
    const { error: avatarDeleteError } = await supabaseAdmin.storage
      .from("profile-avatars")
      .remove(avatarFiles.map((file) => `${userId}/${file.name}`));
    if (avatarDeleteError) {
      throw new Error(`Could not delete profile pictures: ${avatarDeleteError.message}`);
    }
  }

  // Delete the auth user last, so a failure above leaves a recoverable state.
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) throw new Error(deleteError.message ?? "Could not delete the account");
}
