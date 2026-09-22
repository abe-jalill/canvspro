import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

const ROUTES = ["/focus", "/schedule", "/grades", "/assignments", "/announcements"] as const;

/**
 * Warms the most-used route chunks only after the browser is idle. Data is
 * fetched by visible screens, so speculative work never competes with launch.
 */
export function useAppPrefetch(enabled = true) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const warm = async () => {
      for (const to of ROUTES) {
        if (cancelled) return;
        await router.preloadRoute({ to }).catch(() => undefined);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    };

    const supportsIdle = typeof window.requestIdleCallback === "function";
    const idle = supportsIdle
      ? window.requestIdleCallback(() => void warm(), { timeout: 1_500 })
      : window.setTimeout(() => void warm(), 600);

    return () => {
      cancelled = true;
      if (supportsIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [enabled, router]);
}
