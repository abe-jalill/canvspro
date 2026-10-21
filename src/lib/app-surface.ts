// Which pages are the signed-in app. Only those get the app's background (the
// palette tint and the optional wallpaper); every other page (homepage,
// pricing, support, legal, sign-in) keeps the homepage's plain background,
// including while it loads. Decided from the URL, identical on server and
// client, and applied before the first paint by the theme boot script.

/** First path segments of the signed-in area (src/routes/_authenticated). */
export const APP_SECTIONS = [
  "admin",
  "announcements",
  "assignments",
  "class-schedule",
  "completed",
  "courses",
  "dashboard",
  "focus",
  "get-it-done",
  "grades",
  "new-grades",
  "notifications",
  "schedule",
  "settings",
  "study-session",
] as const;

export type Surface = "app" | "site";

export function surfaceFor(pathname: string): Surface {
  const first = pathname.split("/")[1] ?? "";
  return (APP_SECTIONS as readonly string[]).includes(first) ? "app" : "site";
}

/** The same rule as surfaceFor, as a snippet for the inline boot script. */
export const SURFACE_BOOT = `document.documentElement.dataset.surface=${JSON.stringify(
  APP_SECTIONS,
)}.indexOf(location.pathname.split("/")[1]||"")>-1?"app":"site";`;
