import { useEffect, useRef, useState } from "react";

/** A short, one-shot data reveal. Updates animate from the last displayed value. */
export function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const displayed = useRef(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.matches) {
      displayed.current = value;
      setCurrent(value);
      return;
    }

    const from = displayed.current;
    const started = performance.now();
    let frame = 0;
    const finish = () => {
      cancelAnimationFrame(frame);
      displayed.current = value;
      setCurrent(value);
    };
    motionPreference.addEventListener("change", finish);
    const step = (now: number) => {
      const progress = Math.min((now - started) / 700, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (value - from) * eased;
      displayed.current = next;
      setCurrent(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      motionPreference.removeEventListener("change", finish);
    };
  }, [value]);

  return (
    <>
      <span aria-hidden="true">{current.toFixed(decimals)}</span>
      <span className="sr-only">{value.toFixed(decimals)}</span>
    </>
  );
}
