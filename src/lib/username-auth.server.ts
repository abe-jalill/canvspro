export interface UsernameSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email: string | null };
}

/** The same message for every failure, so it never reveals whether a username exists. */
export const USERNAME_SIGN_IN_FAILED = "Invalid username or password.";

/**
 * Resolves a username privately and signs in with the account's password,
 * without exposing the account's email. Shared by the website and the iOS app.
 */
export async function signInWithUsernamePassword(
  username: string,
  password: string,
): Promise<UsernameSession> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: account } = await supabaseAdmin
    .from("account_profiles")
    .select("user_id")
    .eq("username", username)
    .maybeSingle();

  if (!account?.user_id) throw new Error(USERNAME_SIGN_IN_FAILED);
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(account.user_id);
  const email = userData.user?.email;
  if (!email) throw new Error(USERNAME_SIGN_IN_FAILED);

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
  const { data: authData, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !authData.session) throw new Error(USERNAME_SIGN_IN_FAILED);

  return {
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
    expires_in: authData.session.expires_in,
    user: { id: authData.session.user.id, email: authData.session.user.email ?? null },
  };
}
