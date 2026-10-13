import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Masonry packing on a normal CSS grid: the grid is cut into short rows and
 * every card spans as many rows as its own height needs. With dense flow, a
 * later card moves up into any space left beside a taller one, so a short
 * card never leaves a hole under it. Columns stay whatever the grid defines.
 */
const ROW_HEIGHT = 8;
/** Space between cards, both across and down (Tailwind gap-5). */
const GAP = 20;

const gridStyle: CSSProperties = {
  gridAutoRows: `${ROW_HEIGHT}px`,
  gridAutoFlow: "row dense",
  columnGap: `${GAP}px`,
  rowGap: 0,
};

/** The grid itself; pass the column template (e.g. `lg:grid-cols-12`) as a class. */
export function MasonryGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("grid min-w-0", className)} style={gridStyle}>
      {children}
    </div>
  );
}

/** One card in a masonry grid. Re-measures whenever its content resizes. */
export function MasonryCell({
  className,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const content = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    // offsetHeight ignores transforms, so entry animations don't skew it.
    const measure = () => setRows(Math.max(1, Math.ceil((el.offsetHeight + GAP) / ROW_HEIGHT)));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      {...rest}
      className={cn("min-w-0 self-start", className)}
      style={{ ...style, gridRow: rows ? `span ${rows} / span ${rows}` : undefined }}
    >
      <div ref={content} className="min-w-0">
        {children}
      </div>
    </div>
  );
}
