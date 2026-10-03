// CanvasPro service worker.
//
//  1. Offline support: the signed-in pages and the app's own files are cached so
//     CanvasPro still opens without a connection. Only generic page shells and
//     static files are stored here. Account data never is: the app keeps its own
//     per-account cache, which is cleared on sign-out.
//  2. Push notifications (below).
//
// Safety rules: only plain same-origin GET requests are ever handled, pages are
// network-first (so a deploy is picked up immediately and the cache is only a
// fallback), and server functions, APIs and OAuth routes are never touched.

const CACHE_VERSION = "v1";
const ASSET_CACHE = "cp-assets-" + CACHE_VERSION;
const PAGE_CACHE = "cp-pages-" + CACHE_VERSION;
const KNOWN_CACHES = [ASSET_CACHE, PAGE_CACHE];
const MAX_ASSETS = 300;
const MAX_PAGES = 40;
const NAVIGATION_TIMEOUT_MS = 4000;

// The signed-in pages. They are generic shells (the signed-in area renders on
// the device), so caching them exposes nothing about any account.
const APP_PAGES = [
  "/dashboard",
  "/get-it-done",
  "/assignments",
  "/focus",
  "/schedule",
  "/grades",
  "/study-session",
  "/announcements",
  "/class-schedule",
  "/notifications",
  "/settings",
];

const NEVER_HANDLE = ["/api/", "/_serverFn", "/mcp", "/.well-known", "/.lovable", "/lovable/", "/~oauth"];

function pagePath(url) {
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : "/";
  return path || "/";
}

function pageKey(url) {
  return url.origin + pagePath(url);
}

function isHandledNavigation(url) {
  if (url.origin !== self.location.origin) return false;
  return !NEVER_HANDLE.some((prefix) => url.pathname.startsWith(prefix));
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/assets/")) return true;
  return /\.(?:png|jpe?g|webp|avif|gif|svg|ico|woff2?|webmanifest)$/i.test(url.pathname);
}

function isCacheablePage(response) {
  if (!response || response.status !== 200 || response.type !== "basic" || response.redirected) {
    return false;
  }
  if (!/text\/html/i.test(response.headers.get("content-type") || "")) return false;
  return !/no-store/i.test(response.headers.get("cache-control") || "");
}

function isCacheableAsset(response) {
  return Boolean(response) && response.status === 200 && response.type === "basic";
}

async function remember(cacheName, key, response, max) {
  const cache = await caches.open(cacheName);
  await cache.put(key, response);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i += 1) await cache.delete(keys[i]);
}

function offlineResponse() {
  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Offline - CanvasPro</title><style>" +
    "body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;" +
    "font:16px/1.5 system-ui,sans-serif;background:#f4f6f8;color:#16202c}" +
    "@media(prefers-color-scheme:dark){body{background:#0b0d10;color:#e8ecf1}}" +
    "main{max-width:26rem;text-align:center}h1{font-size:1.5rem;font-weight:600;margin:0 0 .5rem}" +
    "p{margin:0 0 1.25rem;opacity:.75}a,button{font:inherit;display:inline-block;margin:0 .25rem;" +
    "padding:.6rem 1.1rem;border-radius:.75rem;border:1px solid currentColor;background:none;" +
    "color:inherit;text-decoration:none;cursor:pointer}</style></head><body><main>" +
    "<h1>You're offline</h1>" +
    "<p>CanvasPro needs a connection the first time you open a page. " +
    "Pages you've opened before still work.</p>" +
    '<button onclick="location.reload()">Try again</button>' +
    '<a href="/dashboard">Open dashboard</a></main></body></html>';
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function precachePages() {
  await Promise.allSettled(
    APP_PAGES.map(async (path) => {
      const response = await fetch(path, { credentials: "same-origin", cache: "reload" });
      if (isCacheablePage(response)) {
        await remember(PAGE_CACHE, self.location.origin + path, response, MAX_PAGES);
      }
    }),
  );
}

// Network first, so a deploy is live immediately. The cached shell is used only
// when the network fails, or has not answered within a few seconds.
async function respondToNavigation(event, url) {
  const key = pageKey(url);
  const cache = await caches.open(PAGE_CACHE);
  const network = fetch(event.request).then((response) => {
    if (isCacheablePage(response)) {
      event.waitUntil(remember(PAGE_CACHE, key, response.clone(), MAX_PAGES).catch(() => {}));
    }
    return response;
  });
  try {
    let timer;
    const slow = new Promise((resolve) => {
      timer = setTimeout(() => resolve(null), NAVIGATION_TIMEOUT_MS);
    });
    const first = await Promise.race([network, slow]);
    clearTimeout(timer);
    if (first) return first;
    const cached = await cache.match(key, { ignoreVary: true });
    if (cached) {
      event.waitUntil(network.catch(() => {}));
      return cached;
    }
    return await network;
  } catch (error) {
    const cached = await cache.match(key, { ignoreVary: true });
    return cached || offlineResponse();
  }
}

// Hashed build files never change, so they are served from cache first.
// Other static files (icons, manifest) are served from cache and refreshed.
async function respondToAsset(event, url) {
  const request = event.request;
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request, { ignoreVary: true });
  const immutable = url.pathname.startsWith("/assets/");
  if (hit && immutable) return hit;
  const network = fetch(request).then((response) => {
    if (isCacheableAsset(response)) {
      event.waitUntil(remember(ASSET_CACHE, request, response.clone(), MAX_ASSETS).catch(() => {}));
    }
    return response;
  });
  if (hit) {
    event.waitUntil(network.catch(() => {}));
    return hit;
  }
  return network;
}

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([self.skipWaiting(), precachePages().catch(() => {})]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith("cp-") && !KNOWN_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    if (isHandledNavigation(url)) event.respondWith(respondToNavigation(event, url));
    return;
  }
  if (isStaticAsset(url)) event.respondWith(respondToAsset(event, url));
});

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
        icon: "/canvaspro-icon-v2-192.png",
        badge: "/canvaspro-icon-v2-192.png",
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
  const requestedTarget = new URL(
    (event.notification.data && event.notification.data.to) || "/dashboard",
    self.location.origin,
  );
  // Push payloads are data, never trusted navigation instructions.
  const target =
    requestedTarget.origin === self.location.origin
      ? requestedTarget.href
      : new URL("/dashboard", self.location.origin).href;
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
