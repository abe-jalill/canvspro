// Server-only half of the VAPID keypair. Never import from client code.
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "@/lib/vapid";

const VAPID_PRIVATE_KEY = "S1L_t6WeBtzpTc9QoCnG1GBaivohHdviU2Zi0TaRa6E";

export const vapid = {
  publicKey: VAPID_PUBLIC_KEY,
  privateKey: process.env["VAPID_PRIVATE_KEY"] || VAPID_PRIVATE_KEY,
  subject: VAPID_SUBJECT,
};
