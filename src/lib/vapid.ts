// VAPID subject for Web Push (ECDSA P-256, RFC 8291/8188).
//
// The public key is NOT hardcoded here on purpose: the browser asks the server
// for its live public key before subscribing (see push-client.ts), so a device
// can never register against a key the server no longer signs with.

export const VAPID_SUBJECT = "mailto:support@canvaspro.app";
