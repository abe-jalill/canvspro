import { useCallback, useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One persistent highlight follows the active destination in full and rail modes. */
export function SlidingSidebarNav({
  activeKey,
  itemCount,
  className,
  children,
}: {
  activeKey: string;
  itemCount: number;
  className?: string;
  children: ReactNode;
}) {
  const navRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const readyFrame = useRef(0);

  const updateHighlight = useCallback(() => {
    const nav = navRef.current;
    const highlight = highlightRef.current;
    if (!nav || !highlight) return;
    const active = nav.querySelector<HTMLElement>('[data-sidebar-active="true"]');
    if (!active) {
      highlight.style.opacity = "0";
      return;
    }
    // Layout offsets ignore transient hover/press transforms and remain stable
    // for course links nested inside a group or a scrolling sidebar.
    highlight.style.width = `${active.offsetWidth}px`;
    highlight.style.height = `${active.offsetHeight}px`;
    highlight.style.transform = `translate3d(${active.offsetLeft}px, ${active.offsetTop}px, 0)`;
    highlight.style.opacity = "1";
    if (highlight.dataset.ready !== "true" && !readyFrame.current) {
      readyFrame.current = requestAnimationFrame(() => {
        highlight.dataset.ready = "true";
        readyFrame.current = 0;
      });
    }
  }, []);

  useLayoutEffect(updateHighlight, [activeKey, itemCount, updateHighlight]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const observer = new ResizeObserver(updateHighlight);
    observer.observe(nav);
    nav.querySelectorAll('[data-sidebar-active]').forEach((item) => observer.observe(item));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(readyFrame.current);
      readyFrame.current = 0;
    };
  }, [itemCount, updateHighlight]);

  return (
    <nav ref={navRef} className={cn("relative", className)}>
      <span
        ref={highlightRef}
        aria-hidden="true"
        className="sidebar-nav-indicator pointer-events-none absolute left-0 top-0 z-0 rounded-xl bg-foreground/[0.08] opacity-0 shadow-sm"
      />
      {children}
    </nav>
  );
}
