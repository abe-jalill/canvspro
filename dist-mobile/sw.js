// CanvasPro push worker. Push/notification handling only — no app-shell caching.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "CanvasPro" };
  }
  const title = data.title || "CanvasPro";
  event.waitUntil(
    (async () => {
      // Countdown pushes reuse one tag per class/day so the alert updates in
      // place instead of stacking a new notification for every step.
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || title,
        renotify: false,
        icon: "/favicon.png",
        badge: "/favicon.png",
        timestamp: Date.now(),
        data: { to: data.to || "/dashboard" },
      });
      if (typeof data.badge === "number" && self.navigator && self.navigator.setAppBadge) {
        try {
          if (data.badge > 0) await self.navigator.setAppBadge(data.badge);
          else await self.navigator.clearAppBadge();
        } catch {
          // badge support is optional
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.to) || "/dashboard",
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
