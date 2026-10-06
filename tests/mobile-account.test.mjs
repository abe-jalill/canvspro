import test from "node:test";
import assert from "node:assert/strict";
import { mobilePreflight, mobileHeaders, handleMobileDeletion } from "../src/lib/mobile-api.ts";
import { requestMobileApi } from "../src/lib/mobile-api-client.ts";
import { deleteAccountData } from "../src/lib/account-deletion.server.ts";

function request({
  auth = "Bearer valid",
  body = { confirm: "DELETE" },
  origin = "capacitor://localhost",
} = {}) {
  return new Request("https://canvaspro.app/api/mobile/delete-account", {
    method: "POST",
    headers: { Authorization: auth, Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("installed iOS can preflight and read account endpoint responses", () => {
  const response = mobilePreflight(request());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "capacitor://localhost");
  assert.match(response.headers.get("Access-Control-Allow-Headers"), /Authorization/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    mobileHeaders(request({ origin: "https://untrusted.example" })).get(
      "Access-Control-Allow-Origin",
    ),
    null,
  );
});

test("deletion requires a bearer session and explicit confirmation", async () => {
  for (const [input, status] of [
    [{ auth: "" }, 401],
    [{ auth: "valid" }, 401],
    [{ body: {} }, 400],
    [{ body: null }, 400],
  ]) {
    const response = await handleMobileDeletion(
      request(input),
      async () => {
        throw new Error("must not authenticate");
      },
      async () => {
        throw new Error("must not delete");
      },
    );
    assert.equal(response.status, status);
  }
  const response = await handleMobileDeletion(
    request(),
    async () => null,
    async () => {
      throw new Error("must not delete");
    },
  );
  assert.equal(response.status, 401);
});

test("mobile deletion uses the verified identity, never a supplied user id", async () => {
  let deleted;
  const response = await handleMobileDeletion(
    request({ body: { confirm: "DELETE", userId: "victim" } }),
    async (token) => {
      assert.equal(token, "valid");
      return "owner";
    },
    async (id) => {
      deleted = id;
    },
  );
  assert.equal(deleted, "owner");
  assert.deepEqual(await response.json(), { deleted: true });
});

test("renewing subscription blocks mobile deletion with an actionable response", async () => {
  const response = await handleMobileDeletion(
    request(),
    async () => "owner",
    async () => {
      throw new Error("An existing subscription may still renew.");
    },
  );
  assert.equal(response.status, 409);
});

test("installed client calls the hosted API with its token and handles server errors", async () => {
  await requestMobileApi("delete-account", { confirm: "DELETE" }, "valid", async (url, init) => {
    assert.equal(url, "https://canvaspro.app/api/mobile/delete-account");
    assert.equal(init.headers.Authorization, "Bearer valid");
    assert.equal(init.credentials, "omit");
    return Response.json({ deleted: true });
  });
  await assert.rejects(
    requestMobileApi("sign-in", {}, undefined, async () =>
      Response.json({ error: "Invalid username or password." }, { status: 401 }),
    ),
    /Invalid username/,
  );
  await assert.rejects(
    requestMobileApi(
      "sign-in",
      {},
      undefined,
      async () => new Response("<html>offline</html>", { status: 503 }),
    ),
    /Could not reach/,
  );
});

function fakeAdmin({
  count = 205,
  storageError = false,
  tableError = false,
  subscriptions = [],
} = {}) {
  let files = Array.from({ length: count }, (_, i) => ({ name: `image-${i}` }));
  const removed = [],
    tables = [];
  let authDeleted = false;
  const client = {
    from(table) {
      return {
        select() {
          return { eq: async () => ({ data: subscriptions, error: null }) };
        },
        delete() {
          return {
            eq: async (column, id) => {
              assert.equal(id, "owner");
              tables.push(table);
              return { error: tableError ? { message: "database unavailable" } : null };
            },
          };
        },
      };
    },
    storage: {
      from: () => ({
        list: async (id, { limit }) => {
          assert.equal(id, "owner");
          return { data: files.slice(0, limit), error: null };
        },
        remove: async (paths) => {
          if (storageError) return { error: { message: "storage unavailable" } };
          removed.push(...paths);
          files = files.filter((file) => !paths.includes(`owner/${file.name}`));
          return { error: null };
        },
      }),
    },
    auth: {
      admin: {
        deleteUser: async (id) => {
          assert.equal(id, "owner");
          assert.equal(files.length, 0);
          authDeleted = true;
          return { error: null };
        },
      },
    },
  };
  return { client, removed, tables, authDeleted: () => authDeleted };
}

test("account deletion removes every avatar page before removing authentication", async () => {
  const state = fakeAdmin();
  await deleteAccountData("owner", state.client);
  assert.equal(state.removed.length, 205);
  assert.equal(new Set(state.removed).size, 205);
  assert.ok(state.tables.includes("user_activity_daily"));
  assert.equal(state.authDeleted(), true);
});

test("cleanup failures keep the auth account available for retry", async () => {
  for (const options of [{ storageError: true }, { tableError: true }]) {
    const state = fakeAdmin(options);
    await assert.rejects(deleteAccountData("owner", state.client), /Could not delete/);
    assert.equal(state.authDeleted(), false);
  }
});

test("potentially renewing subscriptions stop deletion before any cleanup", async () => {
  for (const status of ["active", "trialing", "past_due", "unpaid", "incomplete"]) {
    const state = fakeAdmin({
      subscriptions: [{ status, environment: "live", cancel_at_period_end: false }],
    });
    await assert.rejects(deleteAccountData("owner", state.client), /subscription may still renew/);
    assert.equal(state.tables.length, 0);
    assert.equal(state.removed.length, 0);
  }
});
