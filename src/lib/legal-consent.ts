/** The version people agree to. Bump it only for material changes: everyone is asked to agree again. */
export const LEGAL_POLICY_VERSION = "2026-10-14";
/** When the wording last changed, including clarifications that don't need new agreement. */
export const LEGAL_TEXT_UPDATED: string = "2026-10-14";

/**
 * The seller's exact legal name (a person's full name, or the registered
 * business), which Paddle requires in the Terms and Privacy Policy. Null
 * until it is filled in; the pages then name "the independent operator".
 */
export const SELLER_LEGAL_NAME: string | null = null;
/** The seller's mailing address for the Privacy Policy, also required by Paddle. */
// The owner chose not to publish a personal name or address. Only a business
// name and business address (for example, an LLC's) belong in these two.
export const SELLER_ADDRESS: string | null = null;

/** "Jane Doe, the independent operator of CanvasPro" (or without the name). */
export function sellerIdentity(): string {
  return SELLER_LEGAL_NAME
    ? `${SELLER_LEGAL_NAME}, the independent operator of CanvasPro`
    : "the independent operator of CanvasPro";
}

export function createLegalConsentMetadata(accepted: boolean, now = new Date()) {
  if (!accepted)
    throw new Error("Please agree to the Terms of Use and Privacy Policy to continue.");
  return {
    terms_accepted_version: LEGAL_POLICY_VERSION,
    privacy_accepted_version: LEGAL_POLICY_VERSION,
    legal_accepted_at: now.toISOString(),
  };
}
