export const LEGAL_POLICY_VERSION = "2026-10-10";

export function createLegalConsentMetadata(accepted: boolean, now = new Date()) {
  if (!accepted)
    throw new Error("Please agree to the Terms of Use and Privacy Policy to continue.");
  return {
    terms_accepted_version: LEGAL_POLICY_VERSION,
    privacy_accepted_version: LEGAL_POLICY_VERSION,
    legal_accepted_at: now.toISOString(),
  };
}
