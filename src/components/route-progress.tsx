import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * A quiet acknowledgement for the rare cold navigation that outlives a frame.
 * Fast, prefetched navigations never show it.
 */
export function RouteProgress() {
  const pending = useRouterState({ select: (state) => state.status === "pending" });
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), 140);
    return () => window.clearTimeout(timer);
  }, [pending]);

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-[80] h-px overflow-hidden transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div className="route-progress h-full w-2/5" />
    </div>
  );
}
