import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

/** Animate a committed destination without snapshots or remounting its outlet. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.matches.at(-1)?.pathname ?? state.location.pathname,
  });
  const contentRef = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);

  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const content = contentRef.current;
    if (!content?.animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // A new navigation cancels this animation instead of queuing behind it.
    const animation = content.animate([{ opacity: 0.75 }, { opacity: 1 }], {
      duration: 180,
      easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    });
    return () => animation.cancel();
  }, [pathname]);

  return <div ref={contentRef} className="route-content min-w-0">{children}</div>;
}
