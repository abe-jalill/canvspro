// VAPID public identity for Web Push (ECDSA P-256, RFC 8291/8188).
// Safe to ship to the browser. The matching private key lives in vapid.server.ts.
//
// This constant is only a fallback: the browser asks the server for the live
// public key before subscribing (see push-client.ts), so the key a device
// registers with can never drift from the one the server signs with.

export const VAPID_PUBLIC_KEY =
  "BL9vrxKQlgTV0a9xXfednpn0bzYDkxtS1IfZMggF1uZAcM21zHj1VD-0eKVMJ1cUKgy-l9-5r2bsiPxZjp7thcw";

export const VAPID_SUBJECT = "mailto:support@canvaspro.app";
