import { useEffect, useState } from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function relative(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 45) return "Now";
  const m = Math.floor(s / 60);
  if (m < 60) return `Updated ${m || 1} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Updated ${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `Updated ${d} day${d === 1 ? "" : "s"} ago`;
}

/**
 * Live freshness pill for the Canvas data on the dashboard.
 * Green < 5 min, orange < 30 min, red beyond that. Click to refresh.
 */
export function DataFreshness({ className }: { className?: string }) {
  const qc = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["canvas"] }) > 0;
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const updatedAts = qc
    .getQueryCache()
    .findAll({ queryKey: ["canvas"] })
    .map((q) => q.state.dataUpdatedAt)
    .filter((t) => t > 0);

  if (updatedAts.length === 0 && !fetching) return null;

  const oldest = updatedAts.length ? Math.min(...updatedAts) : Date.now();
  const age = Date.now() - oldest;
  const level = age < 5 * 60_000 ? "fresh" : age < 30 * 60_000 ? "aging" : "stale";
  const dot =
    level === "fresh"
      ? "bg-status-fresh"
      : level === "aging"
        ? "bg-status-aging"
        : "bg-status-stale";

  const label = fetching ? "Refreshing…" : updatedAts.length ? relative(age) : "Loading…";

  return (
    <button
      type="button"
      onClick={() => qc.invalidateQueries({ queryKey: ["canvas"] })}
      title="Refresh Canvas data"
      aria-label={`${label}. Refresh Canvas data`}
      className={cn(
        "glass-inset glass-hover group inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {level === "fresh" && !fetching && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", dot)} />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", dot)} />
      </span>
      <span className="whitespace-nowrap tabular-nums">{label}</span>
      <RefreshCw
        className={cn(
          "h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100",
          fetching && "animate-spin",
        )}
      />
    </button>
  );
}
