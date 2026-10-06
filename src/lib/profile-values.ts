/** Server values, including explicit clears, always win over a device cache. */
export function profileText(...values: unknown[]): string {
  for (const value of values) {
    if (value === null) return "";
    if (typeof value === "string") return value;
  }
  return "";
}

export function accountProfileValue(
  account: { username?: string | null; avatar_path?: string | null } | null,
  key: "username" | "avatar_path",
  legacy: unknown,
): string {
  return account ? profileText(account[key]) : profileText(legacy);
}
