import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 8;
const GAP = 20;

export type MasonrySize = "sm" | "md" | "full";

export interface MasonryItem {
  key: string;
  size: MasonrySize;
  node: ReactNode;
}

function useColumnCount() {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const read = () => {
      const w = window.innerWidth;
      setCols(w >= 1280 ? 3 : w >= 768 ? 2 : 1);
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return cols;
}

function spanFor(size: MasonrySize, cols: number) {
  if (cols === 1) return 1;
  if (size === "full") return cols;
  if (size === "md") return Math.min(2, cols);
  return 1;
}

function Cell({ children, colSpan }: { children: ReactNode; colSpan: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [rows, setRows] = useState(24);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setRows(Math.max(1, Math.ceil((h + GAP) / ROW_HEIGHT)));
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div
      className="min-w-0"
      style={{
        gridColumn: `span ${colSpan} / span ${colSpan}`,
        gridRow: `span ${rows} / span ${rows}`,
      }}
    >
      <div ref={ref} className="min-w-0">
        {children}
      </div>
    </div>
  );
}

/** Gap-free masonry: every card takes only the height it needs. */
export function MasonryGrid({
  items,
  className,
}: {
  items: MasonryItem[];
  className?: string;
}) {
  const cols = useColumnCount();

  return (
    <div
      className={cn("grid min-w-0 items-start", className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW_HEIGHT}px`,
        gridAutoFlow: "row dense",
        columnGap: `${GAP}px`,
      }}
    >
      {items.map((item) => (
        <Cell key={item.key} colSpan={spanFor(item.size, cols)}>
          <div style={{ paddingBottom: GAP }}>{item.node}</div>
        </Cell>
      ))}
    </div>
  );
}
