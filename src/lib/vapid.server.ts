// Server-only half of the VAPID keypair. Never import from client code.
// All three values live in the encrypted secret store — never in source.

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export const vapid = {
  get publicKey() {
    return readEnv("VAPID_PUBLIC_KEY");
  },
  get privateKey() {
    return readEnv("VAPID_PRIVATE_KEY");
  },
  get subject() {
    return process.env["VAPID_SUBJECT"] || "mailto:support@canvaspro.app";
  },
};
