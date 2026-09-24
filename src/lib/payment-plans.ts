export const ALLOWED_PRO_PRICE_KEYS = new Set(["pro_monthly", "pro_yearly"]);

export function isAllowedProPriceKey(value: string): boolean {
  return ALLOWED_PRO_PRICE_KEYS.has(value);
}
