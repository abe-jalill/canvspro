import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useCanvasSync } from "@/hooks/use-canvas-sync";
import { cn } from "@/lib/utils";

const FIVE_MINUTES = 5 * 60_000;
const TEN_MINUTES = 10 * 60_000;

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
  const failed = queries.find((query) => query.state.status === "error");
  const error = failed?.state.error;

  return {
    updatedAt,
    error: error instanceof Error ? error.message : error ? String(error) : null,
  };
}

function elapsedLabel(age: number) {
  const minutes = Math.max(1, Math.floor(age / 60_000));
  return `Updated ${minutes} min ago`;
}

export function CanvasLiveStatus() {
  const queryClient = useQueryClient();
  const { sync, isSyncing } = useCanvasSync();
  const [now, setNow] = useState(Date.now());
  const [status, setStatus] = useState(() => readStatus(queryClient));
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

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
    if (age > TEN_MINUTES) return "stale";
    if (age >= FIVE_MINUTES) return "recent";
    return "live";
  }, [age, status.updatedAt]);

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
  const lastUpdated = status.updatedAt
    ? new Date(status.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <button
      type="button"
      onClick={sync}
      title={online ? "Refresh Canvas data" : `Offline${lastUpdated ? ` · Last updated ${lastUpdated}` : ""}`}
      className="glass-inset glass-hover flex min-h-8 items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground transition-colors hover:text-foreground"
      aria-label={online ? `Canvas data status: ${label}. Tap to refresh.` : `Offline. ${lastUpdated ? `Last updated ${lastUpdated}.` : "No cached data yet."}`}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          !online && "bg-status-warning",
          online && freshness === "live" && "bg-status-live shadow-status-live",
          online && freshness === "recent" && "bg-status-warning",
          online && freshness === "stale" && "bg-destructive",
          online && freshness === "checking" && "animate-pulse bg-muted-foreground",
        )}
      />
      <span>{!online ? `Offline${lastUpdated ? ` · ${lastUpdated}` : ""}` : isSyncing ? "Syncing" : label}</span>
    </button>
  );
}
