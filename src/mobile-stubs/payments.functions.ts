/** Native billing intentionally hands off to the hosted web app. */
export async function createCheckoutSession(): Promise<{ error: string }> {
  return { error: "Checkout must be completed on canvaspro.app." };
}

export async function createPortalSession(): Promise<{ error: string }> {
  return { error: "Billing must be managed on canvaspro.app." };
}
