import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { useCanvasSync } from "@/hooks/use-canvas-sync";
import { useOnlineStatus } from "@/lib/offline";
import { cn } from "@/lib/utils";

const FIVE_MINUTES = 5 * 60_000;
// A few minutes old is normal, not a warning; only genuinely old data gets a color.
const THIRTY_MINUTES = 30 * 60_000;

type CanvasStatus = {
  updatedAt: number;
  error: string | null;
};

function readStatus(queryClient: ReturnType<typeof useQueryClient>): CanvasStatus {
  const queries = queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.queryKey[0] === "canvas");

  const updatedAt = queries.reduce(
    (latest, query) => Math.max(latest, query.state.dataUpdatedAt),
    0,
  );
  // A previous failure is not a current failure while its retry is running.
  const failed = queries.find(
    (query) => query.state.status === "error" && query.state.fetchStatus !== "fetching",
  );
  const error = failed?.state.error;

  return {
    updatedAt,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  };
}

function elapsedLabel(age: number) {
  const minutes = Math.max(1, Math.floor(age / 60_000));
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `Updated ${Math.floor(hours / 24)} days ago`;
}

export function CanvasLiveStatus() {
  const queryClient = useQueryClient();
  const { sync, isSyncing } = useCanvasSync();
  const online = useOnlineStatus();
  const [now, setNow] = useState(Date.now());
  const [status, setStatus] = useState(() => readStatus(queryClient));

  useEffect(() => {
    // The cache notifies synchronously while other components render, so the
    // state update is deferred to a microtask — updating during someone
    // else's render is what produced React's setState-in-render warning.
    let queued = false;
    const apply = () => {
      queued = false;
      setStatus(readStatus(queryClient));
      setNow(Date.now());
    };
    const update = () => {
      if (queued) return;
      queued = true;
      queueMicrotask(apply);
    };
    const unsubscribe = queryClient.getQueryCache().subscribe(update);
    const timer = window.setInterval(apply, 30_000);
    apply();
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, [queryClient]);

  const age = status.updatedAt ? now - status.updatedAt : 0;
  const freshness = useMemo(() => {
    if (!status.updatedAt) return "checking";
    if (age > THIRTY_MINUTES) return "stale";
    if (age >= FIVE_MINUTES) return "recent";
    return "live";
  }, [age, status.updatedAt]);

  // Offline outranks any error: a failed request with no connection is expected.
  if (!online) {
    return (
      <span
        className="glass-inset flex min-h-8 items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground"
        title="You're offline. Showing what you last synced."
        aria-label={`Offline. ${status.updatedAt ? elapsedLabel(age) : "Showing saved data"}.`}
      >
        <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          {status.updatedAt ? `Offline · ${elapsedLabel(age).replace("Updated ", "")}` : "Offline"}
        </span>
      </span>
    );
  }

  if (status.error) {
    return (
      <button
        type="button"
        onClick={sync}
        role="alert"
        className="flex min-h-8 max-w-full items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs text-destructive"
        title={status.error}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-72 truncate">{status.error}</span>
        <RefreshCw className={cn("h-3.5 w-3.5 shrink-0", isSyncing && "animate-spin")} />
      </button>
    );
  }

  const label =
    freshness === "live" ? "LIVE" : freshness === "checking" ? "Checking" : elapsedLabel(age);

  return (
    <button
      type="button"
      onClick={sync}
      title="Refresh Canvas data"
      className="glass-inset glass-hover flex min-h-8 min-w-[5.5rem] items-center justify-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground transition-colors hover:text-foreground"
      aria-label={`Canvas data status: ${label}. Tap to refresh.`}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          freshness === "live" && "bg-status-live shadow-status-live",
          freshness === "recent" && "bg-muted-foreground/60",
          freshness === "stale" && "bg-status-warning",
          freshness === "checking" && "animate-pulse bg-muted-foreground",
        )}
      />
      <span>{isSyncing ? "Syncing" : label}</span>
    </button>
  );
}
