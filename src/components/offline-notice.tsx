import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/lib/offline";

/** A quiet note shown only while the device has no connection. */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="glass-inset mb-3 flex items-start gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground"
    >
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        You're offline, so this is what you last synced. Changes save when you reconnect, so keep
        CanvasPro open until then.
      </p>
    </div>
  );
}
