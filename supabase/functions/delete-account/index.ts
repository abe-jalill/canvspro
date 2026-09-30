import { createClient } from "npm:@supabase/supabase-js@2.110.2";
import { corsHeaders } from "../canvas/cors.ts";

const tables = [
  "account_profiles", "class_nicknames", "class_schedule_entries", "grade_snapshots",
  "notification_prefs", "push_scheduled_alerts", "push_sent_log", "push_subscriptions",
  "native_push_tokens", "subscriptions", "user_assignment_meta", "user_activity_daily",
  "user_preferences", "user_settings",
] as const;

Deno.serve(async (req) => {
  const headers = { ...corsHeaders(req), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) throw new Error("Not signed in");
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "DELETE") throw new Error("Confirmation required");

    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Server configuration is incomplete");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !auth.user) throw new Error("Not signed in");
    const userID = auth.user.id;

    const { data: subscriptions, error: billingError } = await admin
      .from("subscriptions")
      .select("status,cancel_at_period_end,environment")
      .eq("user_id", userID);
    if (billingError) throw new Error("Could not check existing subscriptions");
    if (subscriptions?.some((entry) => entry.environment === "live" && !entry.cancel_at_period_end &&
      ["active", "trialing", "past_due", "unpaid"].includes(entry.status))) {
      return new Response(JSON.stringify({ error: "An existing subscription may still renew. Contact support@canvaspro.app to cancel it before deleting your account." }), { status: 409, headers });
    }

    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq("user_id", userID);
      if (error) throw new Error(`Could not delete ${table}`);
    }

    const { data: files, error: listError } = await admin.storage.from("profile-avatars").list(userID);
    if (listError && listError.message !== "Bucket not found") throw new Error("Could not inspect profile pictures");
    if (files?.length) {
      const { error } = await admin.storage.from("profile-avatars")
        .remove(files.map((file) => `${userID}/${file.name}`));
      if (error) throw new Error("Could not delete profile pictures");
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userID);
    if (deleteError) throw new Error("Could not delete account");
    return new Response(JSON.stringify({ deleted: true }), { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete account";
    const status = message === "Not signed in" ? 401 : message === "Confirmation required" ? 400 : 500;
    return new Response(JSON.stringify({ error: message }), { status, headers });
  }
});
