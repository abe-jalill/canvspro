/**
 * A readable name for a sign-in, from the browser or app that made it
 * ("Chrome on Mac", "CoursePro for iPhone"). The iPhone app reads the same
 * user agents the same way (NativeDevicesView).
 */
export interface DeviceDescription {
  name: string;
  kind: "phone" | "tablet" | "computer" | "other";
}

export function describeDevice(userAgent: string | null | undefined): DeviceDescription {
  const ua = (userAgent ?? "").trim();
  if (!ua) return { name: "Unknown device", kind: "other" };
  // The iPhone app signs in without a browser: its requests say CFNetwork/Darwin.
  if (/CoursePro-iOS|CFNetwork|Darwin\//i.test(ua) && !/Mozilla/i.test(ua)) {
    return { name: "CoursePro for iPhone", kind: "phone" };
  }
  if (!/Mozilla|Opera/i.test(ua)) return { name: "Another app", kind: "other" };

  const os = /iPhone/i.test(ua)
    ? "iPhone"
    : /iPad/i.test(ua)
      ? "iPad"
      : /Android/i.test(ua)
        ? "Android"
        : /CrOS/i.test(ua)
          ? "Chromebook"
          : /Windows/i.test(ua)
            ? "Windows"
            : /Macintosh|Mac OS X/i.test(ua)
              ? "Mac"
              : /Linux/i.test(ua)
                ? "Linux"
                : null;
  const browser = /Edg(e|A|iOS)?\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Firefox|FxiOS/i.test(ua)
        ? "Firefox"
        : /SamsungBrowser/i.test(ua)
          ? "Samsung Internet"
          : /Chrome|CriOS|Chromium/i.test(ua)
            ? "Chrome"
            : /Safari/i.test(ua)
              ? "Safari"
              : "A browser";
  const kind: DeviceDescription["kind"] =
    os === "iPhone" || (os === "Android" && /Mobile/i.test(ua))
      ? "phone"
      : os === "iPad" || os === "Android"
        ? "tablet"
        : "computer";
  return { name: os ? `${browser} on ${os}` : browser, kind };
}

/** "Signed in Oct 3 · Active now" / "… · Active 2 hours ago". */
export function deviceLine(device: { created_at: string; last_active_at: string }, now: number) {
  const signedIn = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(device.created_at),
  );
  const minutes = Math.max(0, Math.round((now - Date.parse(device.last_active_at)) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const active =
    minutes < 5
      ? "Active now"
      : minutes < 60
        ? `Active ${rtf.format(-minutes, "minute")}`
        : minutes < 48 * 60
          ? `Active ${rtf.format(-Math.round(minutes / 60), "hour")}`
          : `Active ${rtf.format(-Math.round(minutes / 1440), "day")}`;
  return `Signed in ${signedIn} · ${active}`;
}
