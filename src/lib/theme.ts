import { useCallback, useEffect, useState } from "react";
import { useSetUserPreference, useUserPreferences } from "@/hooks/use-user-preferences";

const THEME_KEY = "canvas:theme";
const THEME_EVENT = "canvas:theme-changed";
export type Theme = "dark" | "light";

function readTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("light", t === "light");
  root.classList.toggle("dark", t === "dark");
}

function writeTheme(t: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, t);
  } catch {
    // The in-memory theme still works when storage is unavailable.
  }
  applyTheme(t);
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  const preferences = useUserPreferences();
  const { mutate: savePreference } = useSetUserPreference();
  const savedTheme = preferences.data?.theme;

  useEffect(() => {
    const sync = () => {
      const next = readTheme();
      setTheme(next);
      applyTheme(next);
    };
    sync();
    window.addEventListener(THEME_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(THEME_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!preferences.ready || (savedTheme !== "dark" && savedTheme !== "light")) return;
    writeTheme(savedTheme);
  }, [preferences.ready, savedTheme]);

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    writeTheme(next);
    if (preferences.ready) savePreference({ key: "theme", value: next });
  }, [preferences.ready, savePreference]);

  return { theme, toggle };
}
