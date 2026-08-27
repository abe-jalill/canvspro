import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DUE_WINDOWS, hourLabel, isQuietNow, useNotificationPrefs } from "@/lib/notification-prefs";
import {
  disableBackgroundPush,
  enableBackgroundPush,
  isPushEnabled,
  needsHomeScreenInstall,
  pushSupported,
  syncPrefsToServer,
} from "@/lib/push-client";

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
        "glass-inset flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left",
        disabled && "opacity-50",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {description && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function NotificationSettings() {
  const { prefs, set, toggle, reset } = useNotificationPrefs();
  const [permission, setPermission] = useState<string>("default");
  const [background, setBackground] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
    void isPushEnabled().then(setBackground);
  }, []);

  // Keep the backend copy of the preferences in sync so background alerts match.
  useEffect(() => {
    if (!background) return;
    const id = setTimeout(() => void syncPrefsToServer(), 600);
    return () => clearTimeout(id);
  }, [prefs, background]);

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
  }

  async function toggleBackground() {
    setBusy(true);
    try {
      if (background) {
        await disableBackgroundPush();
        setBackground(false);
        toast.success("Background notifications turned off");
      } else {
        const res = await enableBackgroundPush();
        if (res.ok) {
          setBackground(true);
          setPermission("granted");
          toast.success("Background notifications on — alerts arrive even with CanvasPro closed");
        } else {
          toast.error(res.reason);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const off = !prefs.enabled;

  return (
    <div className="flex flex-col gap-5">
      <Toggle
        label="Notifications"
        description="Master switch for all alerts"
        checked={prefs.enabled}
        onChange={() => toggle("enabled")}
      />

      <div className="space-y-2">
        <SectionLabel>When: assignment due dates</SectionLabel>
        <p className="px-1 text-xs text-muted-foreground">
          Pick how far ahead of a due date you want a heads-up.
        </p>
        {DUE_WINDOWS.map((w) => (
          <Toggle
            key={w.key}
            label={w.label}
            checked={prefs[w.key]}
            disabled={off}
            onChange={() => toggle(w.key)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <SectionLabel>What: grades</SectionLabel>
        <Toggle
          label="New grades"
          description={`Only when the score is above ${prefs.gradeThreshold}%`}
          checked={prefs.grades}
          disabled={off}
          onChange={() => toggle("grades")}
        />
        <div className={cn("glass-inset rounded-xl p-3", (off || !prefs.grades) && "opacity-50")}>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="grade-threshold" className="text-sm font-medium">
              Score threshold
            </label>
            <span className="text-sm font-semibold tabular-nums">{prefs.gradeThreshold}%</span>
          </div>
          <input
            id="grade-threshold"
            type="range"
            min={0}
            max={100}
            step={5}
            value={prefs.gradeThreshold}
            disabled={off || !prefs.grades}
            onChange={(e) => set("gradeThreshold", Number(e.target.value))}
            className="mt-3 w-full accent-[hsl(var(--foreground))]"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Set to 0% to be told about every posted grade.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel>What: course activity</SectionLabel>
        <Toggle
          label="New announcements"
          description="Instructor posts in your courses"
          checked={prefs.announcements}
          disabled={off}
          onChange={() => toggle("announcements")}
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>How &amp; when to interrupt</SectionLabel>
        <Toggle
          label="Browser pop-ups"
          description="Off keeps alerts inside the bell menu only"
          checked={prefs.browserPush}
          disabled={off}
          onChange={() => toggle("browserPush")}
        />
        <Toggle
          label="Alerts when CanvasPro is closed"
          description={
            background
              ? "This device gets pushed alerts even with the site closed"
              : needsHomeScreenInstall()
                ? "iPhone/iPad: add CanvasPro to your Home Screen first"
                : "Turn on to keep getting alerts with the browser closed"
          }
          checked={background}
          disabled={off || !prefs.browserPush || busy || !pushSupported()}
          onChange={() => void toggleBackground()}
        />
        <Toggle
          label="Quiet hours"
          description={
            prefs.quietEnabled
              ? `Muted ${hourLabel(prefs.quietStart)} – ${hourLabel(prefs.quietEnd)}${
                  isQuietNow(prefs) ? " · quiet right now" : ""
                }`
              : "Pop-ups can arrive any time"
          }
          checked={prefs.quietEnabled}
          disabled={off || !prefs.browserPush}
          onChange={() => toggle("quietEnabled")}
        />
        {prefs.quietEnabled && (
          <div
            className={cn(
              "glass-inset grid gap-3 rounded-xl p-3 sm:grid-cols-2",
              (off || !prefs.browserPush) && "opacity-50",
            )}
          >
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              Start
              <select
                value={prefs.quietStart}
                disabled={off || !prefs.browserPush}
                onChange={(e) => set("quietStart", Number(e.target.value))}
                className="glass-inset min-h-11 rounded-xl bg-transparent px-3 text-sm text-foreground"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h} className="bg-background">
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              End
              <select
                value={prefs.quietEnd}
                disabled={off || !prefs.browserPush}
                onChange={(e) => set("quietEnd", Number(e.target.value))}
                className="glass-inset min-h-11 rounded-xl bg-transparent px-3 text-sm text-foreground"
              >
                {HOURS.map((h) => (
                  <option key={h} value={h} className="bg-background">
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      {permission !== "granted" && (
        <div className="glass-inset flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {permission === "denied"
              ? "Browser notifications are blocked. Alerts still appear in the bell menu."
              : "Allow browser notifications to get alerts outside the app."}
          </p>
          {permission !== "denied" && (
            <button
              type="button"
              onClick={requestPermission}
              className="glass-hover min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
            >
              Enable
            </button>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={reset}
        className="glass-hover glass-inset min-h-11 self-start rounded-xl px-4 text-sm font-medium text-muted-foreground"
      >
        Reset to defaults
      </button>
    </div>
  );
}
