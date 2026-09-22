import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Network } from "@capacitor/network";
import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeApp } from "@/lib/native";
import { resetPaidAccessCache, subscriptionQueryKey } from "@/lib/subscription";

const STALE_AFTER = 10 * 60_000;

/** Refreshes stale Canvas data after a meaningful resume or network recovery. */
export function NativeAppEvents() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    let active = true;
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
    const refreshSubscription = () => {
      resetPaidAccessCache();
      void queryClient.invalidateQueries({ queryKey: subscriptionQueryKey });
    };
    const reconciliationTimers: number[] = [];
    const clearReconciliationTimers = () => {
      reconciliationTimers.splice(0).forEach(window.clearTimeout);
    };
    const reconcileSubscription = () => {
      clearReconciliationTimers();
      refreshSubscription();
      // Stripe can close checkout before its webhook has updated our database.
      // A couple of bounded retries make the new entitlement appear without a
      // manual relaunch while avoiding permanent polling.
      for (const delay of [2_000, 6_000]) {
        reconciliationTimers.push(window.setTimeout(refreshSubscription, delay));
      }
    };

    const handles: Array<{ remove: () => Promise<void> }> = [];
    const keepHandle = (handle: { remove: () => Promise<void> }) => {
      if (active) handles.push(handle);
      else void handle.remove();
    };
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) backgroundedAt = Date.now();
      else {
        if (!backgroundedAt || Date.now() - backgroundedAt >= STALE_AFTER) refreshStale();
        // Website purchases and cancellations share the same backend row.
        // Reconcile on every meaningful return instead of waiting for a remount.
        if (!backgroundedAt || Date.now() - backgroundedAt >= 5_000) reconcileSubscription();
      }
    }).then(keepHandle);
    void Browser.addListener("browserFinished", reconcileSubscription).then(keepHandle);
    void App.addListener("appUrlOpen", ({ url }) => {
      if (!url.startsWith("canvaspro://billing")) return;
      void Browser.close().catch(() => undefined);
      reconcileSubscription();
      router.history.push("/billing");
    }).then(keepHandle);
    void Network.getStatus().then((status) => {
      wasOffline = !status.connected;
    });
    void Network.addListener("networkStatusChange", ({ connected }) => {
      if (connected && wasOffline) refreshStale();
      wasOffline = !connected;
    }).then(keepHandle);
    void PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const path = String(notification.data?.to ?? "/dashboard");
      if (path.startsWith("/") && !path.startsWith("//")) {
        router.history.push(path);
      }
    }).then(keepHandle);

    return () => {
      active = false;
      clearReconciliationTimers();
      handles.forEach((handle) => void handle.remove());
    };
  }, [queryClient, router]);

  return null;
}
