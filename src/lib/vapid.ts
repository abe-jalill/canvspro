// VAPID keypair for Web Push (ECDSA P-256, RFC 8291/8188).
// The public key is safe to ship to the browser; both halves are pinned here so
// the client subscription key can never drift from the key used to sign pushes.

export const VAPID_PUBLIC_KEY =
  "BIhfNsgMa6yXEPAu8EL2t_PGYabFr2AbqPlhXs5_PyYa2Wr3zmUtN5JoQm7k0ihE3xBbAWTbjVCc2LIQZyeuG8E";

export const VAPID_PRIVATE_KEY = "S1L_t6WeBtzpTc9QoCnG1GBaivohHdviU2Zi0TaRa6E";

export const VAPID_SUBJECT = "mailto:support@canvaspro.app";
