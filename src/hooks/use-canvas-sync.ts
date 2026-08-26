import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Forces a fresh pull of every Canvas query (courses, assignments,
 * announcements, calendar) and reports the result with a toast.
 */
export function useCanvasSync() {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  const sync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ["canvas"], type: "active" });
      queryClient.invalidateQueries({ queryKey: ["canvas"] });
      toast.success("Sync complete", { description: "Canvas data is up to date." });
    } catch (err) {
      toast.error("Sync failed", {
        description: err instanceof Error ? err.message : "Could not reach Canvas.",
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, queryClient]);

  return { sync, isSyncing };
}
