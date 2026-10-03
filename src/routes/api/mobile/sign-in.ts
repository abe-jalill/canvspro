import { createFileRoute } from "@tanstack/react-router";
import { usernameLoginSchema } from "@/lib/username-auth.schema";

const noStore = { "cache-control": "no-store" };

/**
 * Username sign-in for the iOS app, using the same lookup as the website's
 * sign-in form. Answers with the token shape Supabase Auth uses for email
 * sign-in, so the app handles both the same way.
 */
export const Route = createFileRoute("/api/mobile/sign-in")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { USERNAME_SIGN_IN_FAILED, signInWithUsernamePassword } = await import(
          "@/lib/username-auth.server"
        );
        const parsed = usernameLoginSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return Response.json({ error: USERNAME_SIGN_IN_FAILED }, { status: 400, headers: noStore });
        }
        try {
          const session = await signInWithUsernamePassword(parsed.data.username, parsed.data.password);
          return Response.json(session, { headers: noStore });
        } catch (error) {
          const message = error instanceof Error ? error.message : USERNAME_SIGN_IN_FAILED;
          const status = message === USERNAME_SIGN_IN_FAILED ? 401 : 503;
          return Response.json({ error: message }, { status, headers: noStore });
        }
      },
    },
  },
});
