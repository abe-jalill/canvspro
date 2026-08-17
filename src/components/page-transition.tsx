import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Replays the home page's rise-in motion on every route change.
 * The subtree is never remounted — only the animation is restarted —
 * so router state and loaders stay intact.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("page-transition");
    // force reflow so the animation restarts
    void el.offsetWidth;
    el.classList.add("page-transition");
  }, [pathname]);

  return (
    <div ref={ref} className="page-transition">
      {children}
    </div>
  );
}
