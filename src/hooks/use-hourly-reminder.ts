import { useEffect, useState } from "react";
import { scopedKey } from "@/lib/user-scope";

const STORAGE_KEY = "reminders.enabled";
const LAST_HOUR_KEY = "reminders.lastHour";

const START_HOUR = 9;
const END_HOUR = 21;

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(scopedKey(STORAGE_KEY)) === "1";
}

function writeEnabled(v: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(scopedKey(STORAGE_KEY), v ? "1" : "0");
}


function currentHourKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}`;
}

function withinWindow(now = new Date()): boolean {
  const h = now.getHours();
  return h >= START_HOUR && h <= END_HOUR;
}

function fireNotification() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const key = currentHourKey();
  if (window.localStorage.getItem(LAST_HOUR_KEY) === key) return;
  window.localStorage.setItem(LAST_HOUR_KEY, key);
  try {
    new Notification("Assignment check-in", {
      body: "Time to check your assignments.",
      tag: "assignment-check-in",
      silent: false,
    });
  } catch {
    // no-op
  }
}

export function useReminders() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default",
  );

  // hydrate from storage after mount
  useEffect(() => {
    setEnabled(readEnabled());
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    // Fire immediately if we're in-window and haven't fired this hour yet
    if (withinWindow()) fireNotification();

    // Align to the top of the next hour, then tick hourly.
    const now = new Date();
    const msToNextHour =
      (60 - now.getMinutes()) * 60_000 -
      now.getSeconds() * 1000 -
      now.getMilliseconds();

    let hourlyId: ReturnType<typeof setInterval> | undefined;
    const alignId = window.setTimeout(() => {
      if (withinWindow()) fireNotification();
      hourlyId = setInterval(() => {
        if (withinWindow()) fireNotification();
      }, 60 * 60 * 1000);
    }, Math.max(msToNextHour, 1000));

    // Also poll every minute as a safety net (covers wake-from-sleep and
    // long-lived tabs where setTimeout drifts).
    const pollId = setInterval(() => {
      if (withinWindow()) fireNotification();
    }, 60_000);

    return () => {
      window.clearTimeout(alignId);
      if (hourlyId) clearInterval(hourlyId);
      clearInterval(pollId);
    };
  }, [enabled]);

  const toggle = async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      alert("This browser does not support notifications.");
      return;
    }
    if (enabled) {
      setEnabled(false);
      writeEnabled(false);
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    if (perm !== "granted") {
      alert("Enable notifications in your browser to receive reminders.");
      return;
    }
    setEnabled(true);
    writeEnabled(true);
  };

  return { enabled, permission, toggle };
}
