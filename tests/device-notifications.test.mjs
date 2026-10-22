import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import {
  deviceNotificationsEnabled,
  notificationsAllowed,
  setDeviceNotificationsEnabled,
} from "../src/lib/device-notifications.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const makeBrowser = () => {
  const values = new Map();
  const browser = new EventTarget();
  browser.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  browser.self = browser.top = browser;
  browser.location = { hostname: "canvaspro.app" };
  browser.PushManager = function () {};
  browser.Notification = globalThis.Notification;
  return browser;
};

const calls = [];
let deleteError = null;
let unsubscribeResult = true;
let authBarrier = null;
const subscription = {
  endpoint: "https://web.push.apple.com/current-device",
  toJSON: () => ({ keys: { p256dh: "key", auth: "auth" } }),
  unsubscribe: async () => {
    calls.push(["unsubscribe"]);
    return unsubscribeResult;
  },
};
const registration = {
  update: async () => {},
  pushManager: { getSubscription: async () => subscription },
};
globalThis.__notificationTestSupabase = {
  auth: {
    getUser: async () => {
      if (authBarrier) await authBarrier;
      return { data: { user: { id: "account-a" } } };
    },
  },
  from: (table) => ({
    delete: () => ({
      eq: async (key, value) => {
        calls.push(["delete", table, key, value]);
        return { error: deleteError };
      },
    }),
    upsert: async (row) => {
      calls.push(["upsert", table, row]);
      return { error: null };
    },
  }),
  rpc: async (name, args) => {
    calls.push(["rpc", name, args]);
    return { error: null };
  },
};
const stub = (source) => `data:text/javascript,${encodeURIComponent(source)}`;
const hook = registerHooks({
  resolve(specifier, context, next) {
    const aliases = {
      "@/integrations/supabase/client": stub(
        "export const supabase = globalThis.__notificationTestSupabase;",
      ),
      "@/lib/user-scope": stub(
        'export const getUserScope = () => "account-a"; export const scopedKey = key => "account-a:" + key;',
      ),
      "@/lib/notification-prefs": stub(
        "export const notificationEdits = () => ({ snapshot: () => new Map(), acknowledge: () => {} });",
      ),
      "@/lib/background-push-device": new URL(
        "../src/lib/background-push-device.ts",
        import.meta.url,
      ).href,
      "@/lib/device-notifications": new URL("../src/lib/device-notifications.ts", import.meta.url)
        .href,
    };
    if (aliases[specifier]) return { url: aliases[specifier], shortCircuit: true };
    return next(specifier, context);
  },
});
const { disableBackgroundPush, maintainBackgroundPush } = await import("../src/lib/push-client.ts");
hook.deregister();

test("a device opt-out persists, leaves the other device on, and survives an account-wide pause", () => {
  const first = makeBrowser();
  const second = makeBrowser();
  globalThis.window = first;
  setDeviceNotificationsEnabled(false);
  assert.equal(deviceNotificationsEnabled(), false);
  globalThis.window = second;
  assert.equal(deviceNotificationsEnabled(), true);
  assert.equal(notificationsAllowed(false, true), false);
  assert.equal(notificationsAllowed(true, true), true);
  globalThis.window = first;
  assert.equal(deviceNotificationsEnabled(), false);
  assert.equal(notificationsAllowed(true, deviceNotificationsEnabled()), false);
});

test("turning off unsubscribes only this endpoint and never patches the account master", async () => {
  globalThis.window = makeBrowser();
  globalThis.Notification = { permission: "granted" };
  window.Notification = Notification;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      userAgent: "test browser",
      serviceWorker: { getRegistration: async () => registration },
    },
  });
  calls.length = 0;
  await disableBackgroundPush();
  assert.equal(deviceNotificationsEnabled(), false);
  assert.deepEqual(calls, [
    ["delete", "push_subscriptions", "endpoint", subscription.endpoint],
    ["unsubscribe"],
  ]);
  calls.length = 0;
  await maintainBackgroundPush();
  assert.deepEqual(calls, [], "maintenance must not re-register a muted device");
});

test("browser unsubscribe still stops delivery if the server deletion fails", async () => {
  deleteError = { message: "offline" };
  calls.length = 0;
  await disableBackgroundPush();
  assert.ok(calls.some(([name]) => name === "unsubscribe"));
  unsubscribeResult = false;
  await assert.rejects(disableBackgroundPush(), /Couldn't stop background notifications/);
  deleteError = null;
  unsubscribeResult = true;
});

test("a registration already in flight cannot undo a device opt-out", async () => {
  globalThis.window = makeBrowser();
  let release;
  authBarrier = new Promise((resolve) => {
    release = resolve;
  });
  calls.length = 0;
  const registrationInFlight = maintainBackgroundPush();
  // Let maintenance reach its asynchronous registration work.
  await new Promise((resolve) => setImmediate(resolve));
  await disableBackgroundPush();
  release();
  await registrationInFlight;
  authBarrier = null;
  assert.equal(deviceNotificationsEnabled(), false);
  assert.equal(calls.at(-1)[0], "unsubscribe");
  assert.equal(calls.filter(([name]) => name === "rpc").length, 0);
});

test("the ordinary switch is local; only the explicitly named all-devices switch edits enabled", () => {
  const prefs = read("src/lib/notification-prefs.ts");
  assert.match(
    prefs,
    /if \(key === "enabled"\) \{\s+setDeviceNotificationsEnabled\(value as boolean\);\s+return;/,
  );
  assert.match(
    prefs,
    /const setAllDevicesEnabled[\s\S]*notificationEdits\(scope\)\.set\("enabled", enabled\)/,
  );
  const controls = read("src/components/notification-settings.tsx");
  assert.match(controls, /label="Notifications on this device"/);
  assert.match(controls, /label="Allow notifications on all devices"/);
  assert.match(controls, /action: "test", endpoint: subscription\.endpoint/);
  const route = read("src/routes/api/public/push/dispatch.ts");
  assert.match(route, /\.eq\("user_id", user\.id\)\s+\.eq\("endpoint", endpoint\)/);
});
