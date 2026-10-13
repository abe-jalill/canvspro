export const MINIMUM_ACCOUNT_AGE = 18;
// Version 1 was the earlier 13+ rule; those accounts keep `age_13_or_older_confirmed`.
export const AGE_CONFIRMATION_VERSION = 2;

export interface AgeConfirmationMetadata {
  age_18_or_older_confirmed: true;
  age_confirmation_version: number;
  age_confirmed_at: string;
}

/**
 * Keeps the age requirement in the submission path rather than relying only
 * on a checkbox's visual state. The returned fields are saved with the auth
 * user so the confirmation is auditable.
 */
export function createAgeConfirmationMetadata(
  confirmed: boolean,
  now = new Date(),
): AgeConfirmationMetadata {
  if (!confirmed) {
    throw new Error(`You must confirm that you are at least ${MINIMUM_ACCOUNT_AGE} years old.`);
  }

  return {
    age_18_or_older_confirmed: true,
    age_confirmation_version: AGE_CONFIRMATION_VERSION,
    age_confirmed_at: now.toISOString(),
  };
}
