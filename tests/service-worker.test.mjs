import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://app.test";

const basic = (body, init = {}) => {
  const response = new Response(body, init);
  Object.defineProperty(response, "type", { value: "basic" });
  return response;
};
const html = (body = "<html>shell</html>", headers = {}) =>
  basic(body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", ...headers } });

function fakeCaches() {
  const stores = new Map();
  const keyOf = (key) => (typeof key === "string" ? key : key.url);
  const open = async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      put: async (key, response) => void store.set(keyOf(key), response),
      match: async (key) => store.get(keyOf(key))?.clone(),
      keys: async () => [...store.keys()].map((url) => ({ url })),
      delete: async (key) => store.delete(keyOf(key)),
    };
  };
  return {
    stores,
    open,
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
}

/** Runs the real sw.js with a fake network and cache storage. */
function createWorker({ network }) {
  const handlers = {};
  const caches = fakeCaches();
  const calls = [];
  const fetchStub = async (input, init) => {
    const url = typeof input === "string" ? new URL(input, ORIGIN).href : input.url;
    calls.push(url);
    return network(url, input, init);
  };
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type, fn) => void (handlers[type] = fn),
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
    registration: { showNotification: async () => {} },
    navigator: {},
  };
  // Make the 4-second navigation timeout fire almost immediately.
  const setTimeoutStub = (fn, ms) => setTimeout(fn, ms === 4000 ? 1 : ms);
  const context = vm.createContext({
    self,
    caches,
    fetch: fetchStub,
    URL,
    Response,
    Headers,
    Promise,
    Boolean,
    setTimeout: setTimeoutStub,
    clearTimeout,
  });
  vm.runInContext(source, context);

  async function dispatch(request) {
    const waits = [];
    let responded;
    const event = {
      request,
      respondWith: (promise) => void (responded = promise),
      waitUntil: (promise) => void waits.push(promise),
    };
    handlers.fetch(event);
    const response = responded ? await responded : undefined;
    // Background work may never finish (a stalled network); don't wait for it forever.
    await Promise.race([Promise.allSettled(waits), new Promise((resolve) => setTimeout(resolve, 50))]);
    return { handled: Boolean(responded), response };
  }

  async function lifecycle(type) {
    const waits = [];
    handlers[type]({ waitUntil: (promise) => void waits.push(promise) });
    await Promise.all(waits);
  }

  return {
    handlers,
    caches,
    calls,
    install: () => lifecycle("install"),
    activate: () => lifecycle("activate"),
    navigate: (path, init = {}) =>
      dispatch({ method: "GET", mode: "navigate", url: ORIGIN + path, headers: new Headers(), ...init }),
    request: (url, init = {}) =>
      dispatch({ method: "GET", mode: "cors", url, headers: new Headers(), ...init }),
  };
}

const offline = async () => {
  throw new TypeError("Failed to fetch");
};

test("only plain same-origin GETs are ever handled", async () => {
  const worker = createWorker({ network: async () => html() });
  assert.equal((await worker.request(ORIGIN + "/_serverFn/abc", { method: "POST" })).handled, false);
  assert.equal((await worker.request(ORIGIN + "/_serverFn/abc")).handled, false);
  assert.equal((await worker.request(ORIGIN + "/api/public/push/key")).handled, false);
  assert.equal((await worker.request("https://abc.supabase.co/rest/v1/x.png")).handled, false);
  assert.equal((await worker.request(ORIGIN + "/assets/a.js", { method: "POST" })).handled, false);
  assert.equal(
    (await worker.request(ORIGIN + "/video.webp", { headers: new Headers({ range: "bytes=0-9" }) })).handled,
    false,
  );
  for (const path of ["/api/public/push/key", "/mcp", "/.lovable/oauth/consent", "/lovable/email/auth/webhook", "/~oauth/callback"]) {
    assert.equal((await worker.navigate(path)).handled, false, path);
  }
  assert.equal((await worker.navigate("/x", { url: "https://other.test/x" })).handled, false);
});

test("pages are network first and remembered for later", async () => {
  let version = 1;
  const worker = createWorker({ network: async () => html(`shell v${version}`) });
  assert.equal(await (await worker.navigate("/assignments?assignment=5")).response.text(), "shell v1");
  version = 2;
  assert.equal(await (await worker.navigate("/assignments")).response.text(), "shell v2");
});

test("offline, a visited page opens from the saved shell", async () => {
  let up = true;
  const worker = createWorker({ network: async () => (up ? html("saved shell") : offline()) });
  await worker.navigate("/focus");
  up = false;
  const { response } = await worker.navigate("/focus?window=3");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "saved shell");
});

test("offline with nothing saved shows a calm offline page", async () => {
  const worker = createWorker({ network: offline });
  const { response } = await worker.navigate("/grades");
  assert.equal(response.status, 503);
  const text = await response.text();
  assert.match(text, /You're offline/);
  assert.match(text, /Try again/);
});

test("a slow connection falls back to the saved shell", async () => {
  let slow = false;
  const worker = createWorker({
    network: () => (slow ? new Promise(() => {}) : Promise.resolve(html("saved shell"))),
  });
  await worker.navigate("/dashboard");
  slow = true;
  assert.equal(await (await worker.navigate("/dashboard")).response.text(), "saved shell");
});

test("redirects, errors, non-HTML and no-store pages are never saved", async () => {
  const cases = {
    "/redirected": () => {
      const response = html();
      Object.defineProperty(response, "redirected", { value: true });
      return response;
    },
    "/broken": () => basic("oops", { status: 500, headers: { "content-type": "text/html" } }),
    "/data": () => basic("{}", { status: 200, headers: { "content-type": "application/json" } }),
    "/private": () => html("secret", { "cache-control": "private, no-store" }),
  };
  let live = true;
  const worker = createWorker({
    network: async (url) => (live ? cases[new URL(url).pathname]() : offline()),
  });
  for (const path of Object.keys(cases)) await worker.navigate(path);
  live = false;
  for (const path of Object.keys(cases)) {
    assert.equal((await worker.navigate(path)).response.status, 503, path);
  }
});

test("hashed build files come from the cache after the first load", async () => {
  const worker = createWorker({ network: async () => basic("console.log(1)", { status: 200 }) });
  const url = ORIGIN + "/assets/index-abc123.js";
  assert.equal(await (await worker.request(url)).response.text(), "console.log(1)");
  const before = worker.calls.length;
  assert.equal(await (await worker.request(url)).response.text(), "console.log(1)");
  assert.equal(worker.calls.length, before, "second request must not hit the network");
});

test("hashed files still load offline once cached", async () => {
  let up = true;
  const worker = createWorker({ network: async () => (up ? basic("chunk", { status: 200 }) : offline()) });
  const url = ORIGIN + "/assets/route-xyz.js";
  await worker.request(url);
  up = false;
  assert.equal(await (await worker.request(url)).response.text(), "chunk");
});

test("icons are served from cache while a fresh copy is fetched", async () => {
  let version = 1;
  const worker = createWorker({ network: async () => basic(`icon v${version}`, { status: 200 }) });
  const url = ORIGIN + "/canvaspro-icon-v2-192.png";
  assert.equal(await (await worker.request(url)).response.text(), "icon v1");
  version = 2;
  assert.equal(await (await worker.request(url)).response.text(), "icon v1");
  assert.equal(await (await worker.request(url)).response.text(), "icon v2");
});

test("install saves the app pages and survives failures", async () => {
  const worker = createWorker({
    network: async (url) => {
      if (url.endsWith("/grades")) throw new TypeError("down");
      return html("shell");
    },
  });
  await worker.install();
  const pages = [...worker.caches.stores.get("cp-pages-v1").keys()];
  assert.ok(pages.includes(ORIGIN + "/dashboard"));
  assert.ok(pages.includes(ORIGIN + "/assignments"));
  assert.ok(!pages.includes(ORIGIN + "/grades"));
});

test("activate removes old CanvasPro caches and leaves others alone", async () => {
  const worker = createWorker({ network: async () => html() });
  for (const name of ["cp-assets-v0", "cp-pages-v1", "cp-assets-v1", "other-app"]) {
    await worker.caches.open(name);
  }
  await worker.activate();
  const names = await worker.caches.keys();
  assert.deepEqual(names.sort(), ["cp-assets-v1", "cp-pages-v1", "other-app"]);
});

test("the asset cache is capped", async () => {
  const worker = createWorker({ network: async () => basic("x", { status: 200 }) });
  for (let i = 0; i < 305; i += 1) await worker.request(`${ORIGIN}/assets/f${i}.js`);
  assert.equal(worker.caches.stores.get("cp-assets-v1").size, 300);
});

test("push handling is still registered", () => {
  const worker = createWorker({ network: async () => html() });
  for (const type of ["push", "notificationclick", "install", "activate", "fetch"]) {
    assert.equal(typeof worker.handlers[type], "function", type);
  }
});
