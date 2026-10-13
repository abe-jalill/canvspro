/** The version people agree to. Bump it only for material changes: everyone is asked to agree again. */
export const LEGAL_POLICY_VERSION = "2026-10-12";
/** When the wording last changed, including clarifications that don't need new agreement. */
export const LEGAL_TEXT_UPDATED: string = "2026-10-13";

export function createLegalConsentMetadata(accepted: boolean, now = new Date()) {
  if (!accepted)
    throw new Error("Please agree to the Terms of Use and Privacy Policy to continue.");
  return {
    terms_accepted_version: LEGAL_POLICY_VERSION,
    privacy_accepted_version: LEGAL_POLICY_VERSION,
    legal_accepted_at: now.toISOString(),
  };
}
