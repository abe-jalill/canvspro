import { Link } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { TriangleAlert, Sparkles } from "lucide-react";
import { canvasKeyValidationQueryKey, useCanvasKey, verifySavedCanvasKey } from "@/lib/user-settings";
import { useUserScope } from "@/lib/user-scope";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";
import { CanvasTokenModal } from "@/components/canvas-token-modal";
import {
  getCanvasKeyConfirmedAt,
  subscribeCanvasKeyHealth,
} from "@/lib/canvas-key-health";
import { isCanvasKeyWarningCurrent, shouldShowCanvasKeyWarning } from "@/lib/canvas-key-status";

/** Written by the background alert job when Canvas rejects the stored token. */
const CANVAS_KEY_STATUS_PREF = "canvas_key_status";

interface CanvasKeyStatus {
  invalid?: boolean;
  status?: number;
  at?: string;
}

export function CanvasKeyBanner() {
  const scope = useUserScope();
  const { data: key, isLoading } = useCanvasKey();
  const { value: status } = useUserPreferenceKey<CanvasKeyStatus>(CANVAS_KEY_STATUS_PREF, {});
  const confirmedAt = useSyncExternalStore(
    subscribeCanvasKeyHealth,
    getCanvasKeyConfirmedAt,
    () => 0,
  );
  const needsVerification = !!scope && !!key && status?.invalid === true &&
    isCanvasKeyWarningCurrent(status.at, confirmedAt);
  const verification = useQuery({
    queryKey: [...canvasKeyValidationQueryKey, scope, status.at ?? null],
    queryFn: verifySavedCanvasKey,
    enabled: needsVerification,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoading) return null;

  if (shouldShowCanvasKeyWarning(needsVerification, verification)) {
    return (
      <div className="glass-panel-strong mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="min-w-0 text-sm text-muted-foreground">
            Canvas rejected your saved key during a connection check. Create a new key in Canvas
            and save it in Settings.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CanvasTokenModal
            trigger={
              <button
                type="button"
                className="glass-hover inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-foreground px-4 text-sm font-medium text-background"
              >
                <Sparkles className="h-4 w-4" />
                <span>Fix connection</span>
              </button>
            }
          />
          <Link
            to="/settings/canvas"
            className="glass-hover glass-inset inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Settings
          </Link>
        </div>
      </div>
    );
  }

  // CanvasKeyGate directly below owns the no-key onboarding state. Avoid a
  // duplicate banner appearing one frame later and pushing that screen down.
  return null;
}
