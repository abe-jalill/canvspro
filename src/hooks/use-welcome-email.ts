import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { sendWelcomeEmail } from "@/lib/email.functions";
import { scopedKey } from "@/lib/user-scope";

/**
 * Sends the welcome email once per account. The server-side idempotency key
 * makes duplicate calls harmless; the local flag just avoids extra requests.
 */
export function useWelcomeEmail(enabled: boolean) {
  const send = useServerFn(sendWelcomeEmail);

  useEffect(() => {
    if (!enabled) return;
    const key = scopedKey("welcome-email-sent");
    if (typeof window === "undefined" || localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    void send({ data: undefined }).catch(() => {
      localStorage.removeItem(key);
    });
  }, [enabled, send]);
}
