const { AbortController, URLSearchParams } = globalThis;
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const {
  UnishipHttpClient,
} = require("../dist/carrier/infrastructure/uniship/uniship-http.client");
const {
  UNISHIP_ROUTES,
} = require("../dist/carrier/infrastructure/uniship/uniship-routes");
test("Both auth POST and Shipment GET use typed rate admission immediately before dispatch", async () => {
  const arrivals = [];
  const server = createServer((req, res) => {
    arrivals.push(req.url);
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        req.method === "POST"
          ? { token: "synthetic-token", user: { userid: 123 } }
          : { data: [] },
      ),
    );
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const contexts = [],
    context = {
      ownerUserId: "00000000-0000-4000-8000-000000000001",
      connectionId: null,
    };
  const admission = {
    run: async (ctx, signal, operation) => {
      assert.equal(ctx, context);
      contexts.push(ctx);
      signal?.throwIfAborted();
      return operation(signal ?? new AbortController().signal);
    },
  };
  try {
    const client = new UnishipHttpClient({
      apiUrl: "http://127.0.0.1:" + server.address().port,
      admission,
    });
    await assert.rejects(
      client.authenticate({ username: "synthetic", password: "synthetic" }),
    );
    assert.equal(arrivals.length, 0);
    await client.authenticate(
      { username: "synthetic", password: "synthetic" },
      undefined,
      context,
    );
    await client.verify("synthetic-token", undefined, context);
    await client.getShipment(
      UNISHIP_ROUTES.WAREHOUSES,
      "synthetic-token",
      new AbortController().signal,
      new URLSearchParams(),
      context,
    );
    assert.equal(contexts.length, 3);
    assert.equal(arrivals.length, 3);
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(
      client.authenticate(
        { username: "synthetic", password: "synthetic" },
        aborted.signal,
        context,
      ),
    );
    assert.equal(arrivals.length, 3);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
test("HTTP admission shutdown cancels and drains dispatches and refuses new dispatch", async () => {
  const {
    PostgresHttpAdmission,
  } = require("../dist/carrier/infrastructure/uniship/postgres-http-admission");
  const admission = new PostgresHttpAdmission(
    "postgresql://unused/unused",
    "api",
  );
  admission.query = async (_ctx, _token, finish) =>
    finish === undefined
      ? { acquired: true, waitMs: 0, cooldown: false }
      : true;
  const context = {
    ownerUserId: "00000000-0000-4000-8000-000000000001",
    connectionId: null,
  };
  let started;
  const ready = new Promise((r) => (started = r));
  let ended = false;
  const work = admission.run(
    context,
    undefined,
    (signal) =>
      new Promise((resolve, reject) => {
        started();
        signal.addEventListener(
          "abort",
          () => {
            ended = true;
            reject(signal.reason);
          },
          { once: true },
        );
      }),
  );
  const rejected = assert.rejects(work);
  await ready;
  await admission.onApplicationShutdown();
  assert.equal(ended, true);
  await rejected;
  await assert.rejects(
    admission.run(context, undefined, () => assert.fail("shutdown dispatch")),
  );
});

test("abort during successful reservation still releases the owned permit before returning", async () => {
  const {
    PostgresHttpAdmission,
  } = require("../dist/carrier/infrastructure/uniship/postgres-http-admission");
  const admission = new PostgresHttpAdmission(
      "postgresql://unused/unused",
      "api",
    ),
    abort = new AbortController();
  let releases = 0;
  admission.query = async (_context, _token, finish) => {
    if (finish === undefined) {
      abort.abort();
      return { acquired: true, waitMs: 0, cooldown: false };
    }
    releases++;
    return true;
  };
  await assert.rejects(
    admission.run(
      {
        ownerUserId: "00000000-0000-4000-8000-000000000001",
        connectionId: null,
      },
      abort.signal,
      () => assert.fail("aborted dispatch"),
    ),
  );
  assert.equal(releases, 1);
  await admission.onApplicationShutdown();
});
