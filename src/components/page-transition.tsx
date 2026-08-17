import { useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Fades/rises each new route in with the same motion curve as the home page.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });

  return (
    <div key={pathname} className="page-transition">
      {children}
    </div>
  );
}
