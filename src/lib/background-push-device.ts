import { scopedKey } from "@/lib/user-scope";

// Remembers, per account, that this device is registered for closed-app push.
// Read synchronously when the app opens, before the async subscription check
// has had a chance to run.

const KEY = "canvas:background-push-device";

export function setBackgroundPushDevice(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(scopedKey(KEY), "1");
    else window.localStorage.removeItem(scopedKey(KEY));
  } catch {
    // storage is optional
  }
}

export function hasBackgroundPushDevice(): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    return window.localStorage.getItem(scopedKey(KEY)) === "1";
  } catch {
    return false;
  }
}
