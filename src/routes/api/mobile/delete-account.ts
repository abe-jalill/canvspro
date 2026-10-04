import { createFileRoute } from "@tanstack/react-router";

const noStore = { "cache-control": "no-store" };

/**
 * Account deletion for the iOS app (App Store guideline 5.1.1(v)). Requires the
 * signed-in user's access token and an explicit "DELETE" confirmation, then
 * removes exactly what the website's Delete account removes.
 */
export const Route = createFileRoute("/api/mobile/delete-account")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401, headers: noStore });

        const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
        if (body?.confirm !== "DELETE") {
          return Response.json({ error: "Type DELETE to confirm." }, { status: 400, headers: noStore });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data.user) {
          return Response.json({ error: "NOT_AUTHENTICATED" }, { status: 401, headers: noStore });
        }

        try {
          const { deleteAccountData } = await import("@/lib/account-deletion.server");
          await deleteAccountData(data.user.id);
          return Response.json({ deleted: true }, { headers: noStore });
        } catch (deleteError) {
          const message = deleteError instanceof Error ? deleteError.message : "Could not delete the account.";
          // A subscription that may still renew is something the student can act on.
          const status = message.startsWith("An existing subscription") ? 409 : 500;
          console.error("[mobile/delete-account]", data.user.id, message);
          return Response.json({ error: message }, { status, headers: noStore });
        }
      },
    },
  },
});
