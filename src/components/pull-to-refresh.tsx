import { useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCanvasSync } from "@/hooks/use-canvas-sync";

const TRIGGER = 72;
const MAX = 110;

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
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const { sync, isSyncing } = useCanvasSync();

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    const onStart = (e: TouchEvent) => {
      if (isSyncing || e.touches.length !== 1) return;
      if (scrollTopOf(e.target as HTMLElement) > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Rubber-band resistance.
      const next = Math.min(MAX, delta * 0.5);
      if (next > 4 && e.cancelable) e.preventDefault();
      setPull(next);
    };

    const onEnd = async () => {
      const shouldRefresh = pullRef.current >= TRIGGER;
      startY.current = null;
      setPull(0);
      if (shouldRefresh) await sync();
    };

    host.addEventListener("touchstart", onStart, { passive: true });
    host.addEventListener("touchmove", onMove, { passive: false });
    host.addEventListener("touchend", onEnd, { passive: true });
    host.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      host.removeEventListener("touchstart", onStart);
      host.removeEventListener("touchmove", onMove);
      host.removeEventListener("touchend", onEnd);
      host.removeEventListener("touchcancel", onEnd);
    };
  }, [isSyncing, sync]);

  // Keep latest pull value readable inside the stable touchend handler.
  const pullRef = useRef(0);
  pullRef.current = pull;

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
          className={cn(
            "glass-inset flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground",
            (progress >= 1 || isSyncing) && "text-foreground",
          )}
          style={{ opacity: isSyncing ? 1 : progress }}
        >
          <RefreshCw
            className={cn("h-4 w-4", isSyncing && "animate-spin")}
            style={{ transform: isSyncing ? undefined : `rotate(${progress * 270}deg)` }}
          />
        </span>
      </div>
      <div
        className="min-w-0 will-change-transform"
        style={{
          transform: pull ? `translateY(${pull * 0.15}px)` : undefined,
          transition: pull ? undefined : "transform 200ms ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
