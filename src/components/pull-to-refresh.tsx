import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasSync } from "@/hooks/use-canvas-sync";

const TRIGGER = 72;
const MAX = 110;
const DIRECTION_THRESHOLD = 12;
const INTERACTIVE_SELECTOR =
  'input, textarea, select, button, a, [contenteditable="true"], [role="button"], [role="textbox"]';

interface TouchOrigin {
  x: number;
  y: number;
}

function scrollTopOf(el: HTMLElement | null) {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflow = getComputedStyle(node).overflowY;
      if (overflow === "auto" || overflow === "scroll") return node.scrollTop;
    }
    node = node.parentElement;
  }
  return typeof window === "undefined" ? 0 : window.scrollY;
}

/**
 * Native-feeling pull-to-refresh for touch devices: drag down from the top of
 * the list to force a Canvas re-sync.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const origin = useRef<TouchOrigin | null>(null);
  const [pull, setPull] = useState(0);
  const { sync, isSyncing } = useCanvasSync();

  // Keep latest pull value readable inside the stable touchend handler.
  const pullRef = useRef(0);
  pullRef.current = pull;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const onStart = (e: TouchEvent) => {
      origin.current = null;
      if (isSyncing || e.touches.length !== 1) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target || target.closest(INTERACTIVE_SELECTOR)) return;
      if (scrollTopOf(target as HTMLElement) > 0) return;
      origin.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    };

    const onMove = (e: TouchEvent) => {
      const start = origin.current;
      if (!start || e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - start.x;
      const deltaY = e.touches[0].clientY - start.y;
      const distanceX = Math.abs(deltaX);
      const distanceY = Math.abs(deltaY);

      if (Math.max(distanceX, distanceY) < DIRECTION_THRESHOLD) return;

      // Hand horizontal swipes (including the dashboard carousel) back to iOS.
      if (distanceX > distanceY) {
        origin.current = null;
        setPull(0);
        return;
      }

      // An upward gesture is regular page scrolling, not pull-to-refresh.
      if (deltaY <= 0) {
        origin.current = null;
        setPull(0);
        return;
      }

      // Rubber-band resistance.
      const next = Math.min(MAX, (deltaY - DIRECTION_THRESHOLD) * 0.5);
      if (next > 0 && e.cancelable) e.preventDefault();
      setPull(next);
    };

    const onEnd = async () => {
      const shouldRefresh = pullRef.current >= TRIGGER;
      origin.current = null;
      setPull(0);
      if (shouldRefresh) await sync();
    };

    const onCancel = () => {
      origin.current = null;
      setPull(0);
    };

    host.addEventListener("touchstart", onStart, { passive: true });
    host.addEventListener("touchmove", onMove, { passive: false });
    host.addEventListener("touchend", onEnd, { passive: true });
    host.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      host.removeEventListener("touchstart", onStart);
      host.removeEventListener("touchmove", onMove);
      host.removeEventListener("touchend", onEnd);
      host.removeEventListener("touchcancel", onCancel);
    };
  }, [isSyncing, sync]);

  const active = pull > 0 || isSyncing;
  const progress = Math.min(1, pull / TRIGGER);

  return (
    <div ref={hostRef} className="min-w-0">
      <div
        aria-hidden={!active}
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-200 md:hidden"
        style={{ height: isSyncing ? 44 : pull }}
      >
        <span
          role="status"
          aria-live="polite"
          className={cn(
            "glass-inset flex h-9 items-center justify-center gap-2 rounded-full px-3 text-muted-foreground",
            (progress >= 1 || isSyncing) && "text-foreground",
          )}
          style={{ opacity: isSyncing ? 1 : progress }}
        >
          <RefreshCw
            className={cn("h-4 w-4", isSyncing && "animate-spin")}
            style={{ transform: isSyncing ? undefined : `rotate(${progress * 270}deg)` }}
          />
          <span className="text-[11px] font-medium">
            {isSyncing ? "Refreshing…" : progress >= 1 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </span>
      </div>
      <div
        className="min-w-0"
        style={
          pull
            ? { transform: `translateY(${pull * 0.15}px)` }
            : { transition: "transform 200ms ease" }
        }
      >
        {children}
      </div>
    </div>
  );
}
