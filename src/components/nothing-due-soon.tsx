import { useEffect, useState } from "react";
import { Leaf } from "lucide-react";
import { NOTHING_DUE_SOON, RESTFUL_PHRASES } from "@/lib/get-it-done";

/** How long each restful phrase stays before the next fades in. */
const PHRASE_MS = 8_000;

/**
 * Priority Assignments with nothing due in the next five days: a calm line,
 * then a gentle suggestion that changes every few seconds while it's on screen.
 */
export function NothingDueSoon() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * RESTFUL_PHRASES.length));

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIndex((i) => (i + 1) % RESTFUL_PHRASES.length);
      }
    }, PHRASE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
        <Leaf className="h-4 w-4 text-foreground/80" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-relaxed text-foreground/90">{NOTHING_DUE_SOON}</p>
        <p
          key={index}
          className="min-h-[1.25rem] text-sm leading-relaxed text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-1000"
        >
          {RESTFUL_PHRASES[index]}
        </p>
      </div>
    </div>
  );
}
