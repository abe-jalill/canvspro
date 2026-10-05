import { useEffect, useRef, type ReactNode } from "react";

/** A flat hero card with real perspective, following the pointer and page scroll. */
export function DashboardHeroMotion({ children }: { children: ReactNode }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const scroller = document.getElementById("app-main");
    const scrollTop = () => window.scrollY + (scroller?.scrollTop ?? 0);
    const initialScroll = scrollTop();
    const clamp = (value: number, limit = 1) => Math.max(-limit, Math.min(limit, value));
    let visible = false;
    let hovering = false;
    let pointerX = 0;
    let pointerY = 0;
    let currentX = 0;
    let currentY = 0;
    let animationFrame = 0;
    let lastTime = 0;

    const paint = () => {
      card.style.setProperty("--hero-rotate-x", `${currentX.toFixed(3)}deg`);
      card.style.setProperty("--hero-rotate-y", `${currentY.toFixed(3)}deg`);
    };
    const stop = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastTime = 0;
      currentX = currentY = 0;
      paint();
      delete card.dataset.moving;
    };
    const tick = (time: number) => {
      animationFrame = 0;
      if (!visible || reducedMotion.matches || document.hidden) {
        stop();
        return;
      }
      const bounds = frame.getBoundingClientRect();
      const viewport = Math.min(scroller?.clientHeight || window.innerHeight, window.innerHeight);
      const scroll = clamp((scrollTop() - initialScroll) / Math.max(viewport, 1));
      const inside =
        hovering &&
        finePointer.matches &&
        pointerX >= bounds.left &&
        pointerX <= bounds.right &&
        pointerY >= bounds.top &&
        pointerY <= bounds.bottom;
      const mouseX = inside
        ? clamp(((pointerX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1)
        : 0;
      const mouseY = inside
        ? clamp(((pointerY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1)
        : 0;
      const targetX = clamp(mouseY * 2.2 - scroll * 2.4, 4.6);
      const targetY = clamp(-mouseX * 3.8 + scroll * 2.2, 6);
      const elapsed = lastTime ? Math.min(time - lastTime, 64) : 16;
      lastTime = time;
      // Time-based damping feels the same on 60 Hz and high-refresh displays.
      const blend = 1 - Math.exp(-elapsed / 85);
      currentX += (targetX - currentX) * blend;
      currentY += (targetY - currentY) * blend;
      const settled = Math.abs(targetX - currentX) < 0.015 && Math.abs(targetY - currentY) < 0.015;
      if (settled) {
        currentX = targetX;
        currentY = targetY;
      }
      paint();
      if (!settled) animationFrame = requestAnimationFrame(tick);
      else {
        lastTime = 0;
        delete card.dataset.moving;
      }
    };
    const wake = () => {
      if (!animationFrame && visible && !reducedMotion.matches && !document.hidden) {
        card.dataset.moving = "true";
        animationFrame = requestAnimationFrame(tick);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      hovering = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      wake();
    };
    const leave = () => {
      hovering = false;
      wake();
    };
    const onScroll = (event: Event) => {
      if (event.target === document || event.target === scroller) wake();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else wake();
    };
    const onMotionPreference = () => {
      if (reducedMotion.matches) stop();
      else wake();
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) wake();
      else stop();
    });
    observer.observe(frame);
    frame.addEventListener("pointermove", onPointer, { passive: true });
    frame.addEventListener("pointerleave", leave);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("resize", wake, { passive: true });
    reducedMotion.addEventListener("change", onMotionPreference);
    finePointer.addEventListener("change", leave);
    return () => {
      stop();
      observer.disconnect();
      frame.removeEventListener("pointermove", onPointer);
      frame.removeEventListener("pointerleave", leave);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("resize", wake);
      reducedMotion.removeEventListener("change", onMotionPreference);
      finePointer.removeEventListener("change", leave);
    };
  }, []);

  return (
    <div ref={frameRef} className="dashboard-hero-perspective premium-reveal">
      <div ref={cardRef} className="dashboard-hero-motion">
        {children}
      </div>
    </div>
  );
}
