import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Permanently deletes the signed-in account: removes every row this account owns, then deletes
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

    // 2. Remove owned rows everywhere.
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

    // 3. Delete the auth user last, so a failure above leaves a recoverable state.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(deleteError.message ?? "Could not delete the account");

    return { deleted: true };
  });
