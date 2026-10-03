import { useSyncExternalStore } from "react";
import { inEditorPreview } from "@/lib/push-client";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** Live `navigator.onLine`. Assumes online during server rendering. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Registers the service worker that keeps the app opening without a
 * connection. It is skipped where it could only cause confusion: local
 * development, the editor preview, and the native iOS shell (which bundles its
 * own copy of the app).
 */
export function registerOfflineSupport(): void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV || inEditorPreview()) return;
  const native = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
  if (native) return;
  const secure = window.location.protocol === "https:" || window.location.hostname === "localhost";
  if (!secure) return;
  const register = () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Offline support is an enhancement; the app works the same without it.
    });
  };
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
