import { createFileRoute } from "@tanstack/react-router";
import { handleMobileDeletion, mobilePreflight } from "@/lib/mobile-api";

export const Route = createFileRoute("/api/mobile/delete-account")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => mobilePreflight(request),
      POST: ({ request }) =>
        handleMobileDeletion(
          request,
          async (token) => {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data, error } = await supabaseAdmin.auth.getUser(token);
            return error ? null : (data.user?.id ?? null);
          },
          async (userId) => {
            const { deleteAccountData } = await import("@/lib/account-deletion.server");
            await deleteAccountData(userId);
          },
        ),
    },
  },
});
