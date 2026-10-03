import { z } from "zod";

/** Validates a username sign-in. Client-safe: used by the website form, the server function and the app endpoint. */
export const usernameLoginSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  password: z.string().min(1),
});
