import { Link } from "@tanstack/react-router";
import { KeyRound, TriangleAlert } from "lucide-react";
import { useCanvasKey } from "@/lib/user-settings";
import { useUserPreferenceKey } from "@/hooks/use-user-preferences";

/** Written by the background alert job when Canvas rejects the stored token. */
const CANVAS_KEY_STATUS_PREF = "canvas_key_status";

interface CanvasKeyStatus {
  invalid?: boolean;
  status?: number;
  at?: string;
}

export function CanvasKeyBanner() {
  const { data: key, isLoading } = useCanvasKey();
  const { value: status } = useUserPreferenceKey<CanvasKeyStatus>(CANVAS_KEY_STATUS_PREF, {});

  if (isLoading) return null;

  if (key && status?.invalid) {
    return (
      <div className="glass-panel-strong mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="min-w-0 text-sm text-muted-foreground">
            Canvas is no longer accepting your saved key, so your alerts have stopped. Create a new
            key in Canvas and save it again.
          </p>
        </div>
        <Link
          to="/settings"
          className="glass-hover inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background"
        >
          Update key
        </Link>
      </div>
    );
  }

  if (key) return null;

  return (
    <div className="glass-panel-strong mb-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 text-sm text-muted-foreground">
          Add your Canvas API key in Settings to get started.
        </p>
      </div>
      <Link
        to="/settings"
        className="glass-hover inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-medium text-background"
      >
        Open Settings
      </Link>
    </div>
  );
}
