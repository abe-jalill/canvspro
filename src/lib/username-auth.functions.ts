import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const usernameLoginSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  password: z.string().min(1),
});

/** Resolves a username privately and authenticates it without exposing the account email. */
export const signInWithUsername = createServerFn({ method: "POST" })
  .validator(usernameLoginSchema)
  .handler(async ({ data }): Promise<{ accessToken: string; refreshToken: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: account } = await supabaseAdmin
      .from("account_profiles")
      .select("user_id")
      .eq("username", data.username)
      .maybeSingle();

    if (!account?.user_id) throw new Error("Invalid username or password.");
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(account.user_id);
    const email = userData.user?.email;
    if (!email) throw new Error("Invalid username or password.");

    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) throw new Error("Sign-in is temporarily unavailable.");

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (
            (publishableKey.startsWith("sb_publishable_") || publishableKey.startsWith("sb_secret_")) &&
            headers.get("Authorization") === `Bearer ${publishableKey}`
          ) {
            headers.delete("Authorization");
          }
          headers.set("apikey", publishableKey);
          return fetch(input, { ...init, headers });
        },
      },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error } = await authClient.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !authData.session) throw new Error("Invalid username or password.");

    return {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
    };
  });
