import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  COUNTDOWN_LEADS,
  DUE_WINDOWS,
  TONIGHT_HOURS,
  hourLabel,
  isQuietNow,
  useNotificationPrefs,
} from "@/lib/notification-prefs";
import {
  disableBackgroundPush,
  enableBackgroundPush,
  isPushEnabled,
  needsHomeScreenInstall,
  pushSupported,
  syncPrefsToServer,
} from "@/lib/push-client";
import { clearAppBadge } from "@/lib/app-badge";
import { supabase } from "@/integrations/supabase/client";

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

function ChipGroup<T extends number>({
  options,
  selected,
  disabled,
  onToggle,
}: {
  options: Array<{ value: T; label: string }>;
  selected: T[];
  disabled?: boolean;
  onToggle: (value: T) => void;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", disabled && "opacity-50")}>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(o.value)}
            className={cn(
              "min-h-10 rounded-xl border border-glass-border px-3 text-xs font-medium transition-colors",
              on ? "bg-foreground text-background" : "glass-hover text-muted-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-xs text-muted-foreground">{children}</p>;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

/** Section 1 — what Canvas activity is worth an alert. */
export function NotificationTriggers() {
  const { prefs, set, toggle } = useNotificationPrefs();
  const off = !prefs.enabled;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Hint>How far ahead of a due date you want a heads-up.</Hint>
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
        <Toggle
          label="New grades"
          description={`Only when the score is ${prefs.gradeThreshold}% or higher`}
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
            Set to 0% to hear about every posted grade.
          </p>
        </div>
        <Toggle
          label="New announcements"
          description="Instructor posts in your courses"
          checked={prefs.announcements}
          disabled={off}
          onChange={() => toggle("announcements")}
        />
      </div>
    </div>
  );
}

/** Section 2 — live countdowns on the lock screen and app icon. */
export function NotificationCountdowns() {
  const { prefs, set, toggle } = useNotificationPrefs();
  const off = !prefs.enabled;

  function toggleIn(key: "countdownLeads" | "countdownTonightHours", value: number) {
    const list = prefs[key];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    set(key, next.sort((a, b) => a - b));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Toggle
          label="Next class countdown"
          description="Uses the class schedule you entered"
          checked={prefs.countdownClass}
          disabled={off}
          onChange={() => toggle("countdownClass")}
        />
        {prefs.countdownClass && (
          <div className="glass-inset space-y-3 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Warn me…</p>
            <ChipGroup
              options={COUNTDOWN_LEADS.map((l) => ({ value: l.minutes, label: l.label }))}
              selected={prefs.countdownLeads}
              disabled={off}
              onToggle={(v) => toggleIn("countdownLeads", v)}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Toggle
          label="Tonight's 11:59 PM deadlines"
          description="One summary of everything still due today"
          checked={prefs.countdownTonight}
          disabled={off}
          onChange={() => toggle("countdownTonight")}
        />
        {prefs.countdownTonight && (
          <div className="glass-inset space-y-3 rounded-xl p-3">
            <p className="text-xs text-muted-foreground">Remind me at…</p>
            <ChipGroup
              options={TONIGHT_HOURS.map((h) => ({ value: h.hour, label: h.label }))}
              selected={prefs.countdownTonightHours}
              disabled={off}
              onToggle={(v) => toggleIn("countdownTonightHours", v)}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Toggle
          label="Number badge on the app icon"
          description="Shows how many things are due today"
          checked={prefs.badge}
          disabled={off}
          onChange={() => {
            if (prefs.badge) clearAppBadge();
            toggle("badge");
          }}
        />
        <Hint>
          On Android and desktop a countdown updates in place, so you only ever see one alert per
          class. iPhone can't refresh an alert once it's sent, so each step you pick arrives as its
          own notification — choose one or two.
        </Hint>
      </div>
    </div>
  );
}

/** Section 3 — how and when alerts are allowed to reach you. */
export function NotificationDelivery() {
  const { prefs, set, toggle } = useNotificationPrefs();
  const [permission, setPermission] = useState<string>("default");
  const [background, setBackground] = useState(false);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

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

  async function sendTest() {
    setTesting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        toast.error("Please sign in again and retry.");
        return;
      }
      const response = await fetch("/api/public/push/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "test" }),
      });
      const res = (await response.json()) as { ok?: boolean; message?: string };
      if (res.ok) toast.success(res.message ?? "Test notification sent.");
      else toast.error(res.message ?? "Couldn't send the test notification.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the test notification.");
    } finally {
      setTesting(false);
    }
  }

  const off = !prefs.enabled;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
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
        <div className="glass-inset flex flex-col gap-2 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Send a test push to this device to confirm delivery works right now.
          </p>
          <button
            type="button"
            onClick={() => void sendTest()}
            disabled={testing || !background}
            className="glass-hover min-h-11 shrink-0 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50"
          >
            {testing ? "Sending…" : "Send test notification"}
          </button>
        </div>
      </div>

      <div className="space-y-2">
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
    </div>
  );
}

/** Master switch plus a reset, shown above the sections. */
export function NotificationMasterSwitch() {
  const { prefs, toggle, reset } = useNotificationPrefs();
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        label="Notifications"
        description="Master switch for everything below"
        checked={prefs.enabled}
        onChange={() => toggle("enabled")}
      />
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

/** Everything stacked, for surfaces that show one combined panel. */
export function NotificationSettings() {
  return (
    <div className="flex flex-col gap-7">
      <NotificationMasterSwitch />
      <NotificationTriggers />
      <NotificationCountdowns />
      <NotificationDelivery />
    </div>
  );
}
