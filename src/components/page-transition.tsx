import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Replays the home page's rise-in motion once the new route has actually
 * committed. Waiting for the router to go idle avoids animating the old
 * page while the next one is still loading (which looked like a duplicate
 * transition followed by an instant swap).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname, isLoading } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      isLoading: s.status === "pending" || s.isLoading || s.isTransitioning,
    }),
  });
  const ref = useRef<HTMLDivElement>(null);
  const lastAnimated = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (lastAnimated.current === pathname) return;
    lastAnimated.current = pathname;

    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-transition");
    // force reflow so the animation restarts
    void el.offsetWidth;
    el.classList.add("page-transition");
  }, [pathname, isLoading]);

  return (
    <div ref={ref} className="page-transition">
      {children}
    </div>
  );
}
