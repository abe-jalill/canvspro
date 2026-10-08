export const PALETTES = [
  { id: "forest", name: "Forest", color: "#78b98e", description: "A little breathing room." },
  { id: "blue", name: "Blue", color: "#76a9e8", description: "Clear skies, clear mind." },
  { id: "violet", name: "Violet", color: "#b39ae7", description: "Space for a new idea." },
  { id: "rose", name: "Rose", color: "#dc93ad", description: "A warmer kind of focus." },
] as const;
export type Palette = (typeof PALETTES)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";
/** "wave" shows the palette's blurred wallpaper behind the app; "plain" is the solid color. */
export type Wallpaper = "wave" | "plain";
export function normalizeWallpaper(value: unknown): Wallpaper {
  return value === "plain" ? "plain" : "wave";
}
export function normalizePalette(value: unknown): Palette {
  return PALETTES.some((palette) => palette.id === value) ? (value as Palette) : "forest";
}
export function normalizeThemeMode(value: unknown): ThemeMode {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveTheme(mode: ThemeMode, prefersDark: boolean): "dark" | "light" {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}
