import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSetUserPreference, useUserPreferences } from "@/hooks/use-user-preferences";
import { useAuthUserId } from "@/lib/auth-user";
import {
  normalizePalette,
  normalizeThemeMode,
  normalizeWallpaper,
  resolveTheme,
  type Palette,
  type ThemeMode,
  type Wallpaper,
} from "@/lib/theme-options";

export type Theme = "dark" | "light";
type Appearance = { mode: ThemeMode; palette: Palette; wallpaper: Wallpaper };
type ThemeContextValue = Appearance & {
  theme: Theme;
  ready: boolean;
  saving: boolean;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: Palette) => void;
  setWallpaper: (wallpaper: Wallpaper) => void;
  toggle: () => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
const defaults: Appearance = { mode: "system", palette: "forest", wallpaper: "wave" };

function readAppearance(): Appearance {
  try {
    return {
      mode: normalizeThemeMode(localStorage.getItem("canvas:theme")),
      palette: normalizePalette(localStorage.getItem("canvas:palette")),
      wallpaper: normalizeWallpaper(localStorage.getItem("canvas:wallpaper")),
    };
  } catch {
    return defaults;
  }
}

/** One account-aware owner applies themes; consumers never compete to sync the DOM. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preferences = useUserPreferences();
  const { userId, isPending } = useAuthUserId();
  const save = useSetUserPreference();
  const [local, setLocal] = useState<Appearance>(defaults);
  const [prefersDark, setPrefersDark] = useState(false);
  const appearance =
    userId && preferences.ready
      ? {
          mode: normalizeThemeMode(preferences.data?.theme),
          palette: normalizePalette(preferences.data?.color_theme),
          wallpaper: normalizeWallpaper(preferences.data?.wallpaper),
        }
      : local;
  const theme = resolveTheme(appearance.mode, prefersDark);

  useEffect(() => {
    setLocal(readAppearance());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const systemChanged = () => setPrefersDark(media.matches);
    const storageChanged = () => setLocal(readAppearance());
    systemChanged();
    media.addEventListener("change", systemChanged);
    window.addEventListener("storage", storageChanged);
    return () => {
      media.removeEventListener("change", systemChanged);
      window.removeEventListener("storage", storageChanged);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    root.dataset.palette = appearance.palette;
    root.dataset.wallpaper = appearance.wallpaper;
    // The homepage is dark unless someone explicitly picked Light.
    root.dataset.themeMode = appearance.mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#09120e" : "#f4f6f2");
    try {
      localStorage.setItem("canvas:theme", appearance.mode);
      localStorage.setItem("canvas:palette", appearance.palette);
      localStorage.setItem("canvas:wallpaper", appearance.wallpaper);
    } catch {
      /* Theme remains usable without browser storage. */
    }
  }, [appearance.mode, appearance.palette, appearance.wallpaper, theme]);

  const ready = !isPending && (!userId || preferences.ready);
  function update(
    key: "theme" | "color_theme" | "wallpaper",
    value: ThemeMode | Palette | Wallpaper,
  ) {
    if (!ready) return;
    if (userId) save.mutate({ key, value });
    else
      setLocal((previous) =>
        key === "theme"
          ? { ...previous, mode: normalizeThemeMode(value) }
          : key === "wallpaper"
            ? { ...previous, wallpaper: normalizeWallpaper(value) }
            : { ...previous, palette: normalizePalette(value) },
      );
  }
  return (
    <ThemeContext.Provider
      value={{
        ...appearance,
        theme,
        ready,
        saving: save.isPending,
        setMode: (mode) => update("theme", mode),
        setPalette: (palette) => update("color_theme", palette),
        setWallpaper: (wallpaper) => update("wallpaper", wallpaper),
        toggle: () => update("theme", theme === "dark" ? "light" : "dark"),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Theme state and its provider intentionally share one module so every surface
// consumes the same context instance during hot reload.
// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}
