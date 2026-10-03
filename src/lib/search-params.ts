/**
 * The router keeps address-bar values readable (`?assignment=123`), and its URL
 * parser turns number-like text into a real number. A check for `typeof value
 * === "string"` therefore silently drops IDs and ranges such as `3` or `123`.
 * Read search values through this so a number and its text form are the same.
 */
export function searchText(value: unknown): string | undefined {
  if (typeof value === "string") return value === "" ? undefined : value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}
