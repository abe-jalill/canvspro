import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { hourLabel, isQuietNow, useNotificationPrefs } from "@/lib/notification-prefs";
import {
  disableBackgroundPush,
  enableBackgroundPush,
  isPushEnabled,
  needsHomeScreenInstall,
  pushSupported,
  syncPrefsToServer,
} from "@/lib/push-client";
import { supabase } from "@/integrations/supabase/client";
import { setDeviceNotificationsEnabled } from "@/lib/device-notifications";

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "glass-inset flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left",
        disabled && "opacity-50",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border border-glass-border transition-colors",
          checked ? "bg-foreground" : "bg-foreground/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full transition-all",
            checked ? "left-[1.375rem] bg-background" : "left-0.5 bg-foreground/60",
          )}
        />
      </span>
    </button>
  );
}

/** How early a class reminder arrives. One choice keeps it to one alert per class. */
const CLASS_LEADS = [
  { minutes: 5, label: "5 min before" },
  { minutes: 15, label: "15 min before" },
  { minutes: 30, label: "30 min before" },
  { minutes: 60, label: "1 hour before" },
];

/** Turns closed-app alerts on for this device, or sends a test once they're on. */
function ThisDevice({
  disabled,
  deviceEnabled,
  paused,
}: {
  disabled: boolean;
  deviceEnabled: boolean;
  paused: boolean;
}) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void isPushEnabled()
      .then((enabled) => {
        if (active) setOn(enabled);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [deviceEnabled, disabled]);

  async function turnOn() {
    setBusy(true);
    try {
      if (!pushSupported()) {
        setDeviceNotificationsEnabled(true);
        return;
      }
      const res = await enableBackgroundPush();
      if (res.ok) {
        setOn(true);
        toast.success("Notifications are on for this device");
      } else {
        toast.error(res.reason);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t enable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      await disableBackgroundPush();
      setOn(false);
      toast.success("Notifications are off for this device");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn’t disable notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        toast.error("Please sign in again and retry.");
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setOn(false);
        toast.error("Enable background alerts on this device first.");
        return;
      }
      const response = await fetch("/api/public/push/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "test", endpoint: subscription.endpoint }),
      });
      const res = (await response.json()) as { ok?: boolean; message?: string };
      if (res.ok) toast.success(res.message ?? "Test notification sent.");
      else toast.error(res.message ?? "Couldn't send the test notification.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the test notification.");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    "glass-hover min-h-10 shrink-0 rounded-xl px-4 text-sm font-semibold disabled:opacity-50";

  return (
    <div className="space-y-2">
      <Toggle
        label="Notifications on this device"
        description={
          deviceEnabled
            ? paused
              ? "Paused by the all-devices setting"
              : "Your other devices keep their own setting"
            : "Off only on this device"
        }
        checked={deviceEnabled}
        disabled={busy || disabled}
        onChange={() => void (deviceEnabled ? turnOff() : turnOn())}
      />
      {pushSupported() ? (
        <div className="glass-inset flex flex-wrap items-center justify-between gap-2 rounded-xl p-3">
          <p className="text-xs text-muted-foreground">
            {on ? "Background notifications are set up" : "Get notifications with CoursePro closed"}
          </p>
          <button
            type="button"
            onClick={() => void (on ? sendTest() : turnOn())}
            disabled={busy || disabled || paused || !deviceEnabled}
            className={cn(buttonClass, "bg-foreground text-background")}
          >
            {busy ? "Working…" : on ? "Send test" : "Enable background alerts"}
          </button>
        </div>
      ) : (
        <p className="px-1 text-xs text-muted-foreground">
          {needsHomeScreenInstall()
            ? "Add CoursePro to your Home Screen for notifications when the app is closed."
            : "This browser can show notifications only while CoursePro is open."}
        </p>
      )}
    </div>
  );
}

/**
 * The primary switch controls only this device. The separate all-devices
 * control is the account-wide pause used by the background sender.
 */
export function NotificationSettings() {
  const { prefs, set, toggle, ready, deviceEnabled, allDevicesEnabled, setAllDevicesEnabled } =
    useNotificationPrefs();
  const [savingAll, setSavingAll] = useState(false);

  async function toggleAllDevices() {
    setSavingAll(true);
    setAllDevicesEnabled(!allDevicesEnabled);
    try {
      if (!(await syncPrefsToServer()))
        throw new Error(
          "The all-devices setting could not sync. Check your connection and try again.",
        );
      toast.success(
        allDevicesEnabled
          ? "Notifications paused on all devices"
          : "All-devices pause lifted; device choices are unchanged",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The all-devices setting could not sync.");
    } finally {
      setSavingAll(false);
    }
  }

  // The account copy is shared with the background check and native iOS.
  useEffect(() => {
    if (!ready) return;
    const id = setTimeout(() => {
      void syncPrefsToServer()
        .then((ok) => {
          if (!ok) toast.error("Notification settings could not sync. Try again.");
        })
        .catch(() => toast.error("Notification settings could not sync. Try again."));
    }, 600);
    return () => clearTimeout(id);
  }, [prefs, ready, allDevicesEnabled]);

  const off = !ready || !prefs.enabled;
  const dueOn = prefs.due1d || prefs.due2d || prefs.due3d || prefs.due1w;
  const lead = prefs.countdownLeads[0] ?? 15;
  const tonightHour = prefs.countdownTonightHours[0] ?? 18;

  function setDueDates(on: boolean) {
    set("due1d", on);
    set("due2d", on);
    set("due3d", on);
    if (!on) set("due1w", false);
  }

  function setClassReminders(on: boolean) {
    set("countdownClass", on);
    if (on && prefs.countdownLeads.length === 0) set("countdownLeads", [15]);
  }

  function setTonight(on: boolean) {
    set("countdownTonight", on);
    if (on && prefs.countdownTonightHours.length === 0) set("countdownTonightHours", [18]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <ThisDevice disabled={false} deviceEnabled={deviceEnabled} paused={!allDevicesEnabled} />
        <Toggle
          label="Allow notifications on all devices"
          description={
            allDevicesEnabled
              ? "Each device uses its own on/off setting"
              : "Paused everywhere; device settings are remembered"
          }
          checked={allDevicesEnabled}
          disabled={!ready || savingAll}
          onChange={() => void toggleAllDevices()}
        />
      </div>

      <div className="space-y-2">
        <p className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Notify me about
        </p>
        <Toggle
          label="Due dates"
          description="3 days, 2 days and 1 day before"
          checked={dueOn}
          disabled={off}
          onChange={() => setDueDates(!dueOn)}
        />
        <Toggle
          label="New grades"
          description={`When you score ${prefs.gradeThreshold}% or higher`}
          checked={prefs.grades}
          disabled={off}
          onChange={() => toggle("grades")}
        />
        <Toggle
          label="Announcements"
          description="New posts from your instructors"
          checked={prefs.announcements}
          disabled={off}
          onChange={() => toggle("announcements")}
        />
        <Toggle
          label="Class reminders"
          description="Before each class on your schedule"
          checked={prefs.countdownClass}
          disabled={off}
          onChange={() => setClassReminders(!prefs.countdownClass)}
        />
        {prefs.countdownClass && (
          <div className={cn("flex flex-wrap gap-2 px-1", off && "opacity-50")}>
            {CLASS_LEADS.map((option) => (
              <button
                key={option.minutes}
                type="button"
                aria-pressed={lead === option.minutes}
                disabled={off}
                onClick={() => set("countdownLeads", [option.minutes])}
                className={cn(
                  "min-h-9 rounded-xl border border-glass-border px-3 text-xs font-medium transition-colors",
                  lead === option.minutes
                    ? "bg-foreground text-background"
                    : "glass-hover text-muted-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        <Toggle
          label="Due tonight"
          description={`At ${hourLabel(tonightHour)} if something is due by 11:59 PM`}
          checked={prefs.countdownTonight}
          disabled={off}
          onChange={() => setTonight(!prefs.countdownTonight)}
        />
        <Toggle
          label="Streak reminder"
          description="“Don't break your streak!!!” at 6:00 PM if you haven't opened CoursePro today"
          checked={prefs.streakReminder}
          disabled={off}
          onChange={() => toggle("streakReminder")}
        />
      </div>

      <Toggle
        label="Quiet at night"
        description={`No notifications ${hourLabel(prefs.quietStart)} – ${hourLabel(prefs.quietEnd)}${
          prefs.quietEnabled && isQuietNow(prefs) ? " · quiet right now" : ""
        }`}
        checked={prefs.quietEnabled}
        disabled={off}
        onChange={() => toggle("quietEnabled")}
      />
    </div>
  );
}
