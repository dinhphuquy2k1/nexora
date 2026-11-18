require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { stores, row, page, job } = require("../helpers/uniship-fixture.cjs");
const {
  UnishipHttpClient,
} = require("../../dist/carrier/infrastructure/uniship/uniship-http.client");
const {
  UnishipShipmentProvider,
} = require("../../dist/shipment/infrastructure/uniship/uniship-shipment.provider");
const {
  createSyncRuntimeCapabilities,
} = require("../../dist/sync/infrastructure/sync-runtime-capabilities");
async function fixture(t, handler, options = {}) {
  const requests = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url);
    handler(req, res);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(
    () =>
      new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }),
  );
  const client = new UnishipHttpClient({
    apiUrl: `http://127.0.0.1:${server.address().port}`,
    ...options,
  });
  const calls = [];
  const lifecycle = {
    withToken: async (owner, id, operation) => {
      calls.push([owner, id]);
      return operation("synthetic-private-token");
    },
  };
  const store = {
    read: async () => ({
      connection: {
        id: "connection",
        provider: "uniship",
        externalAccountId: "account",
      },
      generation: 0,
      version: 0,
    }),
  };
  const provider = new UnishipShipmentProvider(
    client,
    lifecycle,
    store,
    () => {},
  );
  return { client, provider, requests, calls, store };
}
test("canonical Uniship routes preserve wire values and the GET-only runtime allowlist", () => {
  const {
    UNISHIP_ROUTES,
    isUnishipReadRoute,
  } = require("../../dist/carrier/infrastructure/uniship/uniship-routes");
  assert.deepEqual(UNISHIP_ROUTES, {
    AUTH: "/client/api-token-auth/",
    VERIFY: "/client/api-token-verify/",
    SHIPMENTS: "/client/api/transition/",
    WAREHOUSES: "/client/api/chinaStores/",
  });
  assert.equal(isUnishipReadRoute(UNISHIP_ROUTES.SHIPMENTS), true);
  assert.equal(isUnishipReadRoute(UNISHIP_ROUTES.WAREHOUSES), true);
  for (const path of [
    UNISHIP_ROUTES.AUTH,
    UNISHIP_ROUTES.VERIFY,
    "/client/api/customers/1",
    "/client/api/transition",
    "https://kh.uniship.vn/client/api/transition/",
    "",
    null,
    undefined,
  ])
    assert.equal(isUnishipReadRoute(path), false);
});
test("FULL-only declaration, exact100-row query, existing scoped token callback and empty production registry", async (t) => {
  const f = await fixture(t, (req, res) => {
    assert.equal(req.method, "GET");
    assert.equal(req.headers.authorization, "Bearer synthetic-private-token");
    assert.equal(req.headers.accept, "application/json");
    const url = new URL(req.url, "http://fixture");
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/client/api/chinaStores/") return res.end(stores);
    assert.equal(url.pathname, "/client/api/transition/");
    assert.equal(url.searchParams.get("ecommerce"), "true");
    assert.deepEqual(
      JSON.parse(
        Buffer.from(url.searchParams.get("filter"), "base64").toString(),
      ),
      { filter: [{ column: "IsEcommerce", value: 1, condition: "equal" }] },
    );
    assert.deepEqual(
      [...url.searchParams.keys()],
      ["ecommerce", "filter", "page", "rowsPerPage", "q"],
    );
    assert.equal(url.searchParams.get("rowsPerPage"), "100");
    assert.equal(url.searchParams.get("q"), "");
    res.end(page([row()]));
  });
  assert.equal(f.provider.strategy("uniship", "SHIPMENT"), "FULL");
  assert.equal(f.provider.strategy("uniship", "CUSTOMER"), null);
  assert.equal(f.provider.strategy("other", "SHIPMENT"), null);
  assert.equal(
    createSyncRuntimeCapabilities().resolve("uniship", "SHIPMENT"),
    null,
  );
  const result = await f.provider.fetch(
    job(),
    new globalThis.AbortController().signal,
  );
  assert.equal(result.done, true);
  assert.equal(result.records.length, 1);
  assert.deepEqual(f.calls, [["owner", "connection"]]);
  assert.equal(f.requests.length, 2);
});

test("invalid job, account or generation fails before HTTP; cancellation is forwarded", async (t) => {
  const f = await fixture(t, (_req, res) => res.end(stores));
  for (const change of [
    { provider: "other" },
    { sync_type: "CUSTOMER" },
    { fetch_strategy: "INCREMENTAL" },
    { next_page: 0 },
    { next_cursor: "x" },
    { target_watermark: "x" },
    { carrier_connection_id: null },
    { external_account_id: "foreign" },
    { generation: 1 },
    { lifecycle_version: 1 },
  ])
    await assert.rejects(
      f.provider.fetch(job(change), new globalThis.AbortController().signal),
    );
  assert.equal(f.requests.length, 0);
  const control = new globalThis.AbortController();
  control.abort();
  await assert.rejects(f.provider.fetch(job(), control.signal));
  assert.equal(f.requests.length, 0);
});

test("HTTP failures and redirects are safe typed page failures, never a successful empty page", async (t) => {
  let status = 503;
  const f = await fixture(t, (_req, res) => {
    res.writeHead(status, {
      "retry-after": "2",
      location: "https://must-not-contact.invalid",
      "content-type": "application/json",
    });
    res.end('{"private":"synthetic-private-marker"}');
  });
  for (const [s, code] of [
    [401, "SYNC_UNAVAILABLE"],
    [403, "SYNC_UNAVAILABLE"],
    [429, "PROVIDER_RETRY"],
    [503, "PROVIDER_RETRY"],
    [302, "PROVIDER_RETRY"],
    [400, "SOURCE_INVALID"],
  ]) {
    status = s;
    await assert.rejects(
      f.provider.fetch(job(), new globalThis.AbortController().signal),
      (e) => {
        assert.equal(e.code, code);
        assert.equal(String(e).includes("synthetic-private-marker"), false);
        if (s === 429) assert.equal(e.retryAfterMs, 2000);
        return true;
      },
    );
  }
});

test("GET retains existing gate, path restriction, timeout, abort and bounded body contracts", async (t) => {
  const f = await fixture(t, (_req, res) =>
    res.end("x".repeat(8 * 1024 * 1024 + 1)),
  );
  await assert.rejects(
    f.client.getShipment(
      "/client/api/chinaStores/",
      "token",
      new globalThis.AbortController().signal,
    ),
    (e) => e.name === "UnishipResponseError",
  );
  await assert.rejects(
    f.client.getShipment(
      "/client/api/customers/1",
      "token",
      new globalThis.AbortController().signal,
    ),
  );
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error("live fetch must not occur");
  };
  try {
    for (const path of ["/client/api-token-auth/", "/client/api-token-verify/"])
      await assert.rejects(
        f.client.getShipment(
          path,
          "token",
          new globalThis.AbortController().signal,
        ),
        (e) => e.code === "SERVICE_UNAVAILABLE",
      );
    for (const apiUrl of [
      "https://kh.uniship.vn",
      "http://outside.invalid",
      "https://user:secret@outside.invalid",
      "https://outside.invalid?query=secret",
    ])
      await assert.rejects(
        new UnishipHttpClient({ apiUrl, liveAuthorized: true }).getShipment(
          "/client/api/chinaStores/",
          "token",
          new globalThis.AbortController().signal,
        ),
      );
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
  const stalled = await fixture(t, () => {}, { timeoutMs: 30 });
  await assert.rejects(
    stalled.provider.fetch(job(), new globalThis.AbortController().signal),
    (e) => e.code === "PROVIDER_RETRY",
  );
  const cancellation = new globalThis.AbortController();
  const pending = stalled.provider.fetch(job(), cancellation.signal);
  cancellation.abort();
  await assert.rejects(pending);
});
