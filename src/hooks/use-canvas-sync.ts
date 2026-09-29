import { useCallback } from "react";
import { useQueryClient, useIsFetching, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { resetCanvasBundle } from "@/lib/canvas.functions";
const syncs = new WeakMap<QueryClient, Promise<void>>();

/**
 * Forces a fresh pull of every Canvas query (courses, assignments,
 * announcements, calendar) and reports the result with a toast.
 */
export function useCanvasSync() {
  const queryClient = useQueryClient();
  const isSyncing = useIsFetching({ queryKey: ["canvas"] }) > 0;

  const sync = useCallback(async () => {
    const existing = syncs.get(queryClient);
    if (existing) return existing;
    const operation = Promise.resolve().then(async () => {
      try {
        if (!queryClient.isFetching({ queryKey: ["canvas"] })) resetCanvasBundle();
        await queryClient.invalidateQueries({ queryKey: ["canvas"], refetchType: "none" });
        await queryClient.refetchQueries({ queryKey: ["canvas"], type: "active" }, { throwOnError: true, cancelRefetch: false });
        toast.success("Sync complete", { description: "Canvas data is up to date." });
      } catch (err) {
        toast.error("Sync failed", {
          description: err instanceof Error ? err.message : "Could not reach Canvas.",
        });
      } finally {
        syncs.delete(queryClient);
      }
    });
    syncs.set(queryClient, operation);
    return operation;
  }, [queryClient]);

  return { sync, isSyncing };
}
