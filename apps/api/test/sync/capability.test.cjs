const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  SyncCapabilityRegistry,
} = require("../../dist/sync/infrastructure/sync-capability.registry");
const {
  createSyncRuntimeCapabilities,
} = require("../../dist/sync/infrastructure/sync-runtime-capabilities");
const {
  SyncRepository,
} = require("../../dist/sync/infrastructure/sync-job.repository");
const {
  SyncJobExecutor,
} = require("../../dist/sync/application/sync-job-executor.service");
const {
  loadSyncConfig,
  SyncConfigurationError,
} = require("../../dist/sync/domain/sync-policy");
const {
  unavailableProvider,
  unavailableProcessor,
} = require("../../dist/sync/infrastructure/provider-fetch.adapter");
const cfg = () =>
  loadSyncConfig({
    SYNC_ENABLED: "true",
    SYNC_SHIPMENT_ENABLED: "true",
    SYNC_CUSTOMER_ENABLED: "true",
  });
function registration(providerName, type, version = 1) {
  return {
    providerName,
    type,
    provider: {
      strategy: (p, t) => (p === providerName && t === type ? "FULL" : null),
      fetch: async () => ({ records: [], done: true }),
    },
    domain: {
      version,
      supports: (t) => t === type,
      begin: async () => {
        throw Error("unit resolver cannot create a transaction");
      },
    },
  };
}

test("static capability lookup preserves exact provider/type and processor version", () => {
  const a = registration("fixture-a", "SHIPMENT", 2),
    b = registration("fixture-b", "CUSTOMER", 3);
  const registry = new SyncCapabilityRegistry([a, b]);
  assert.equal(registry.resolve("fixture-a", "SHIPMENT").provider, a.provider);
  assert.equal(registry.resolve("fixture-a", "SHIPMENT").processor.version, 2);
  assert.equal(registry.resolve("fixture-b", "CUSTOMER").provider, b.provider);
  assert.equal(registry.resolve("fixture-b", "CUSTOMER").processor.version, 3);
  for (const [p, t] of [
    ["fixture-a", "CUSTOMER"],
    ["fixture-b", "SHIPMENT"],
    ["unknown", "SHIPMENT"],
    ["fixture-a", "UNKNOWN"],
  ])
    assert.equal(registry.resolve(p, t), null);
});

test("duplicate and malformed registration fail closed without accepting a handler", () => {
  const a = registration("fixture-a", "SHIPMENT");
  assert.throws(
    () => new SyncCapabilityRegistry([a, a]),
    SyncConfigurationError,
  );
  for (const version of [0, -1, 1.5, NaN, "1"])
    assert.throws(
      () =>
        new SyncCapabilityRegistry([
          registration("fixture-a", "SHIPMENT", version),
        ]),
      SyncConfigurationError,
    );
  for (const providerName of ["", "a".repeat(33)])
    assert.throws(
      () =>
        new SyncCapabilityRegistry([registration(providerName, "SHIPMENT")]),
      SyncConfigurationError,
    );
  assert.throws(
    () => new SyncCapabilityRegistry([registration("fixture-a", "UNKNOWN")]),
    SyncConfigurationError,
  );
});

test("provider/processor support and captured version must all agree", () => {
  const a = registration("fixture-a", "SHIPMENT");
  const registry = new SyncCapabilityRegistry([a]);
  a.provider.strategy = () => null;
  assert.equal(registry.resolve("fixture-a", "SHIPMENT"), null);
  a.provider.strategy = () => "NOT_A_STRATEGY";
  assert.equal(registry.resolve("fixture-a", "SHIPMENT"), null);
  a.provider.strategy = () => "FULL";
  a.domain.supports = () => false;
  assert.equal(registry.resolve("fixture-a", "SHIPMENT"), null);
  a.domain.supports = () => true;
  a.domain.version = 2;
  assert.equal(registry.resolve("fixture-a", "SHIPMENT"), null);
});

test("global/type flags cannot create a production capability; API/worker share empty declarations", async () => {
  const api = createSyncRuntimeCapabilities(),
    worker = createSyncRuntimeCapabilities();
  assert.notEqual(api, worker);
  for (const type of ["SHIPMENT", "CUSTOMER"]) {
    assert.equal(api.resolve("uniship", type), null);
    assert.equal(worker.resolve("uniship", type), null);
  }
  const registry = new SyncCapabilityRegistry([
    registration("fixture-a", "SHIPMENT"),
  ]);
  const queue = new SyncRepository("unused-unit-url", cfg(), registry);
  assert.equal(queue.available("fixture-a", "SHIPMENT"), true);
  for (const config of [
    { ...cfg(), enabled: false },
    { ...cfg(), types: [] },
  ])
    assert.equal(
      new SyncRepository("unused-unit-url", config, registry).available(
        "fixture-a",
        "SHIPMENT",
      ),
      false,
    );
  assert.equal(
    new SyncRepository("unused-unit-url", cfg(), api).available(
      "uniship",
      "SHIPMENT",
    ),
    false,
  );
  await assert.rejects(
    unavailableProvider.fetch(),
    (e) => e.code === "SYNC_UNAVAILABLE",
  );
  await assert.rejects(
    unavailableProcessor.apply(),
    (e) => e.code === "PROCESSOR_UNAVAILABLE",
  );
});

test("executor selects matching fetcher/version rather than a separate injected pair", async () => {
  const calls = [],
    pages = [];
  const a = registration("fixture-a", "SHIPMENT", 2),
    b = registration("fixture-b", "CUSTOMER", 3);
  for (const r of [a, b])
    r.provider.fetch = async (job) => {
      calls.push([r.providerName, job.provider, job.sync_type]);
      return { records: [], done: true };
    };
  const capabilities = new SyncCapabilityRegistry([a, b]);
  const queue = {
    capabilities,
    config: cfg(),
    available: () => true,
    heartbeat: async () => {},
    page: async (job, page, version) =>
      pages.push([job.provider, version, page.done]),
    wait: async () => assert.fail("valid pair must not retry"),
  };
  for (const r of [a, b])
    await new SyncJobExecutor(queue).execute(
      {
        provider: r.providerName,
        sync_type: r.type,
        processing_phase: "FETCHING",
        fetch_strategy: "FULL",
        attempt_count: 0,
      },
      new globalThis.AbortController().signal,
    );
  assert.deepEqual(calls, [
    ["fixture-a", "fixture-a", "SHIPMENT"],
    ["fixture-b", "fixture-b", "CUSTOMER"],
  ]);
  assert.deepEqual(pages, [
    ["fixture-a", 2, true],
    ["fixture-b", 3, true],
  ]);
});

test("executor never fetches an unknown or disabled capability", async () => {
  let fetched = 0;
  const a = registration("fixture-a", "SHIPMENT");
  a.provider.fetch = async () => {
    fetched++;
    throw Error("must not fetch");
  };
  for (const allowed of [true, false]) {
    let code;
    const queue = {
      capabilities: new SyncCapabilityRegistry([a]),
      config: cfg(),
      available: () => allowed,
      heartbeat: async () => {},
      wait: async (_job, c) => {
        code = c;
      },
    };
    const provider = allowed ? "unknown" : "fixture-a";
    await new SyncJobExecutor(queue).execute(
      {
        provider,
        sync_type: "SHIPMENT",
        processing_phase: "FETCHING",
        fetch_strategy: "FULL",
        attempt_count: 0,
      },
      new globalThis.AbortController().signal,
    );
    assert.equal(code, "SYNC_UNAVAILABLE");
  }
  assert.equal(fetched, 0);
});

test("strategy mismatch and cancellation cannot checkpoint or call an unrelated provider", async () => {
  let fetched = 0,
    checkpointed = 0;
  const a = registration("fixture-a", "SHIPMENT");
  a.provider.fetch = async () => {
    fetched++;
    return { records: [], done: true };
  };
  const cases = [
    {
      strategy: "INCREMENTAL",
      signal: new globalThis.AbortController().signal,
      expected: "SYNC_UNAVAILABLE",
    },
    {
      strategy: "FULL",
      signal: globalThis.AbortSignal.abort(
        Error("private-cancellation-reason"),
      ),
      expected: "PROVIDER_RETRY",
    },
  ];
  for (const c of cases) {
    let observed;
    const queue = {
      capabilities: new SyncCapabilityRegistry([a]),
      config: cfg(),
      available: () => true,
      heartbeat: async () => {},
      page: async () => checkpointed++,
      wait: async (_job, code) => {
        observed = code;
      },
    };
    await new SyncJobExecutor(queue).execute(
      {
        provider: "fixture-a",
        sync_type: "SHIPMENT",
        processing_phase: "FETCHING",
        fetch_strategy: c.strategy,
        attempt_count: 0,
      },
      c.signal,
    );
    assert.equal(observed, c.expected);
  }
  assert.equal(fetched, 0);
  assert.equal(checkpointed, 0);
});

test("provider failure classification forwards only the existing closed retry code and delay", async () => {
  const { SyncError } = require("../../dist/sync/domain/sync-policy");
  for (const [failure, expected] of [
    [new SyncError("PROVIDER_RETRY", 2500), "PROVIDER_RETRY"],
    [Error("private-provider-response"), "INTERNAL_ERROR"],
  ]) {
    const a = registration("fixture-a", "SHIPMENT");
    a.provider.fetch = async () => {
      throw failure;
    };
    let observed;
    const queue = {
      capabilities: new SyncCapabilityRegistry([a]),
      config: cfg(),
      available: () => true,
      heartbeat: async () => {},
      page: async () => assert.fail("failed fetch cannot checkpoint"),
      wait: async (...args) => {
        observed = args;
      },
    };
    await new SyncJobExecutor(queue).execute(
      {
        provider: "fixture-a",
        sync_type: "SHIPMENT",
        processing_phase: "FETCHING",
        fetch_strategy: "FULL",
        attempt_count: 0,
      },
      new globalThis.AbortController().signal,
    );
    assert.equal(observed[1], expected);
    assert.equal(typeof observed[2], "number");
    if (expected === "PROVIDER_RETRY") assert.ok(observed[2] >= 2500);
    assert.equal(
      JSON.stringify(observed).includes("private-provider-response"),
      false,
    );
  }
});

test("actual API and worker composition factories share fail-closed capabilities without extra credentials", async () => {
  require("reflect-metadata");
  const { AppModule } = require("../../dist/app.module");
  const { SyncWorkerModule } = require("../../dist/worker/sync-worker.module");
  const { SyncPort } = require("../../dist/sync/application/sync.port");
  const keys = [
    "DATABASE_URL",
    "SYNC_ENABLED",
    "SYNC_SHIPMENT_ENABLED",
    "SYNC_CUSTOMER_ENABLED",
  ];
  const before = new Map(keys.map((key) => [key, process.env[key]]));
  const queues = [];
  try {
    Object.assign(process.env, {
      DATABASE_URL: "unused-unit-url",
      SYNC_ENABLED: "true",
      SYNC_SHIPMENT_ENABLED: "true",
      SYNC_CUSTOMER_ENABLED: "true",
    });
    const apiFactory = Reflect.getMetadata("providers", AppModule).find(
      (p) => p.provide === SyncPort,
    );
    const workerFactory = Reflect.getMetadata(
      "providers",
      SyncWorkerModule,
    ).find((p) => p.provide === SyncRepository);
    const api = apiFactory.useFactory({ DATABASE_URL: "unused-unit-url" }),
      worker = workerFactory.useFactory();
    queues.push(api, worker);
    for (const type of ["SHIPMENT", "CUSTOMER"]) {
      assert.equal(api.available("uniship", type), false);
      assert.equal(worker.available("uniship", type), false);
      assert.equal(api.capabilities.resolve("uniship", type), null);
      assert.equal(worker.capabilities.resolve("uniship", type), null);
    }
  } finally {
    for (const queue of queues) await queue.close();
    for (const [key, value] of before) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("Customer binding rejects processor version drift after asynchronous begin and during decision", async () => {
  const {
    createCustomerSyncBinding,
  } = require("../../dist/customer/infrastructure/customer-sync-domain.binding");
  const job = {
    id: "11111111-1111-4111-8111-111111111111",
    owner_user_id: "22222222-2222-4222-8222-222222222222",
    carrier_connection_id: "33333333-3333-4333-8333-333333333333",
    provider: "uniship",
    external_account_id: "fixture-account",
    sync_type: "CUSTOMER",
  };
  const source = {
    id: "44444444-4444-4444-8444-444444444444",
    sourceVersion: 1,
    processorVersion: 1,
    payload: {},
  };
  for (const duringDecision of [false, true]) {
    let applied = 0;
    const processor = {
      version: 1,
      supports: () => true,
      apply: async () => {
        applied++;
        if (duringDecision) processor.version = 2;
        return { outcome: "NEEDS_REVIEW" };
      },
    };
    const binding = createCustomerSyncBinding(processor);
    const invocation = await binding.begin(
      { $queryRaw: async () => [{ customer_id: null }] },
      job,
      source,
      "shared",
    );
    if (!duringDecision) processor.version = 2;
    try {
      await assert.rejects(
        invocation.decide(),
        (e) => e.code === "PROCESSOR_UNAVAILABLE",
      );
    } finally {
      invocation.close();
    }
    assert.equal(applied, duringDecision ? 1 : 0);
  }
});
