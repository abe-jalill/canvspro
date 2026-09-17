// Server-only half of the VAPID keypair. Never import from client code.
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/vapid";

export const vapid = {
  publicKey: VAPID_PUBLIC_KEY,
  privateKey: "S1L_t6WeBtzpTc9QoCnG1GBaivohHdviU2Zi0TaRa6E",
  subject: VAPID_SUBJECT,
};
