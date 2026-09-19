// Validates browser-supplied return URLs so a payment flow can never hand the
// user off to an outside site (open redirect).

const ALLOWED_HOSTS = [
  "canvaspro.app",
  "www.canvaspro.app",
  "canvaspremium.lovable.app",
];

/** Lovable-hosted preview/published hosts for this project. */
const ALLOWED_HOST_SUFFIXES = [".lovable.app", ".lovableproject.com"];


export function assertSafeReturnUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid return URL");
  }

  const isLocal =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!isLocal && url.protocol !== "https:") throw new Error("Invalid return URL");

  const allowed =
    isLocal ||
    ALLOWED_HOSTS.includes(url.hostname) ||
    ALLOWED_HOST_SUFFIXES.some((s) => url.hostname.endsWith(s));

  if (!allowed) throw new Error("Invalid return URL");
  // Return the original string: Stripe needs the literal
  // {CHECKOUT_SESSION_ID} placeholder, which URL normalisation would encode.
  return raw;
}
