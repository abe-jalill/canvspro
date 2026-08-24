import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sent: boolean }> => {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { userId, supabase } = context;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email;
    if (!email) return { sent: false };

    try {
      const result = await sendTemplateEmail("welcome", email, {
        templateData: {
          name: (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0],
          appUrl: "https://canvaspro.app",
        },
        idempotencyKey: `welcome-${userId}`,
      });
      return { sent: result.sent };
    } catch (error) {
      console.error(error);
      return { sent: false };
    }
  });
