/** A choice for this browser installation, isolated from every other device. */
const KEY = "coursepro:device-notifications-enabled";
export const DEVICE_NOTIFICATIONS_EVENT = "coursepro:device-notifications-changed";

export function deviceNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(KEY) !== "false";
  } catch {
    return true;
  }
}

export function setDeviceNotificationsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(enabled));
  window.dispatchEvent(new Event(DEVICE_NOTIFICATIONS_EVENT));
}

/** An account pause never overwrites a device's own on/off choice. */
export function notificationsAllowed(accountEnabled: boolean, deviceEnabled: boolean): boolean {
  return accountEnabled && deviceEnabled;
}
