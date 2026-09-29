// Accounts allowed to see the private usage screen.
// Client-side use is for hiding UI only — every stats query is re-checked on the server.
export const ADMIN_EMAILS = ["abrahim.jalil11@gmail.com", "ajalil@ltu.edu"] as const;

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase() as (typeof ADMIN_EMAILS)[number]);
}
