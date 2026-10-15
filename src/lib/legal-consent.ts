/** The version people agree to. Bump it only for material changes: everyone is asked to agree again. */
export const LEGAL_POLICY_VERSION = "2026-10-14";
/** When the wording last changed, including clarifications that don't need new agreement. */
export const LEGAL_TEXT_UPDATED: string = "2026-10-14";

/**
 * The company that sells CoursePro, exactly as registered with Michigan.
 * Paddle requires the seller's company name in the Terms. CoursePro is its
 * assumed name (DBA). Never a person's name.
 */
export const SELLER_LEGAL_NAME: string | null = "Construction Safety & Managment, LLC";
/**
 * A business mailing address for the Privacy Policy. Optional (Paddle's
 * domain review doesn't require one); never a home address.
 */
export const SELLER_ADDRESS: string | null = null;

/** "Example Co, LLC, doing business as CoursePro" (or the generic operator). */
export function sellerIdentity(): string {
  return SELLER_LEGAL_NAME
    ? `${SELLER_LEGAL_NAME}, doing business as CoursePro`
    : "the independent operator of CoursePro";
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
