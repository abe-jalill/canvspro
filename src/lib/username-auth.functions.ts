import { createServerFn } from "@tanstack/react-start";
import { usernameLoginSchema } from "@/lib/username-auth.schema";

/** Resolves a username privately and authenticates it without exposing the account email. */
export const signInWithUsername = createServerFn({ method: "POST" })
  .validator(usernameLoginSchema)
  .handler(async ({ data }): Promise<{ accessToken: string; refreshToken: string }> => {
    const { signInWithUsernamePassword } = await import("@/lib/username-auth.server");
    const session = await signInWithUsernamePassword(data.username, data.password);
    return { accessToken: session.access_token, refreshToken: session.refresh_token };
  });
