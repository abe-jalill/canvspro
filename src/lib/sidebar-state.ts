import { useCallback, useEffect, useState } from "react";
import { getUserScope, scopedKey, subscribeToUserScope } from "@/lib/user-scope";

export type SidebarMode = "full" | "rail" | "hidden";

const BASE_KEY = "sidebar-mode";
const listeners = new Set<() => void>();
let current: SidebarMode = read();

function read(): SidebarMode {
  try {
    const v = localStorage.getItem(scopedKey(BASE_KEY));
    return v === "rail" || v === "hidden" ? v : "full";
  } catch {
    return "full";
  }
}

function emit() {
  listeners.forEach((fn) => fn());
}

export function setSidebarMode(mode: SidebarMode) {
  current = mode;
  try {
    localStorage.setItem(scopedKey(BASE_KEY), mode);
  } catch {
    /* ignore */
  }
  emit();
}

export function getSidebarMode(): SidebarMode {
  return current;
}

export function useSidebarMode(): [SidebarMode, (m: SidebarMode) => void] {
  const [mode, setMode] = useState<SidebarMode>(current);

  useEffect(() => {
    const sync = () => setMode(read());
    listeners.add(sync);
    // Re-read when the signed-in account changes so each user keeps their own mode.
    const unsub = subscribeToUserScope(() => {
      current = read();
      emit();
    });
    // Keep module cache in sync if the scope already differs (e.g. fresh sign-in).
    if (getUserScope() != null) {
      const fresh = read();
      if (fresh !== current) {
        current = fresh;
        setMode(fresh);
      }
    }
    return () => {
      listeners.delete(sync);
      unsub();
    };
  }, []);

  const set = useCallback((m: SidebarMode) => setSidebarMode(m), []);
  return [mode, set];
}
