import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { App } from "@capacitor/app";
import { Network } from "@capacitor/network";
import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeApp } from "@/lib/native";

const STALE_AFTER = 10 * 60_000;

/** Refreshes stale Canvas data after a meaningful resume or network recovery. */
export function NativeAppEvents() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isNativeApp()) return;
    let backgroundedAt = 0;
    let wasOffline = false;
    const refreshStale = () => {
      const latest = queryClient
        .getQueryCache()
        .getAll()
        .filter((query) => query.queryKey[0] === "canvas")
        .reduce((value, query) => Math.max(value, query.state.dataUpdatedAt), 0);
      if (!latest || Date.now() - latest >= STALE_AFTER) {
        void queryClient.invalidateQueries({ queryKey: ["canvas"] });
      }
    };

    const handles: Array<{ remove: () => Promise<void> }> = [];
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) backgroundedAt = Date.now();
      else if (!backgroundedAt || Date.now() - backgroundedAt >= STALE_AFTER) refreshStale();
    }).then((handle) => handles.push(handle));
    void Network.getStatus().then((status) => {
      wasOffline = !status.connected;
    });
    void Network.addListener("networkStatusChange", ({ connected }) => {
      if (connected && wasOffline) refreshStale();
      wasOffline = !connected;
    }).then((handle) => handles.push(handle));
    void PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const path = String(notification.data?.to ?? "/dashboard");
      if (path.startsWith("/") && !path.startsWith("//")) {
        window.history.pushState({}, "", path);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }).then((handle) => handles.push(handle));

    return () => {
      handles.forEach((handle) => void handle.remove());
    };
  }, [queryClient]);

  return null;
}
