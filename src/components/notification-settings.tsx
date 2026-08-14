import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { DUE_WINDOWS, useNotificationPrefs } from "@/lib/notification-prefs";

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
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {description}
          </span>
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

export function NotificationSettings() {
  const { prefs, toggle } = useNotificationPrefs();
  const [permission, setPermission] = useState<string>("default");

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setPermission(p);
  }

  const off = !prefs.enabled;

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label="Notifications"
        description="Master switch for all alerts"
        checked={prefs.enabled}
        onChange={() => toggle("enabled")}
      />

      <div className="space-y-2">
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Assignment due dates
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
        <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Other alerts
        </p>
        <Toggle
          label="New grades"
          description="Celebrate scores above 80%"
          checked={prefs.grades}
          disabled={off}
          onChange={() => toggle("grades")}
        />
        <Toggle
          label="New announcements"
          checked={prefs.announcements}
          disabled={off}
          onChange={() => toggle("announcements")}
        />
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
