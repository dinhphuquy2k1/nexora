const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  SyncService,
  syncPagination,
} = require("../../dist/sync/application/sync-admission.service");
const { SyncError } = require("../../dist/sync/domain/sync-policy");
const id = "11111111-1111-4111-8111-111111111111";
test("Sync strict commands and canonical pagination reject mass assignment before persistence", async () => {
  let calls = 0;
  const service = new SyncService({
    admit: async () => {
      calls++;
      return {};
    },
    configure: async () => {
      calls++;
      return {};
    },
  });
  for (const body of [
    null,
    [],
    {},
    { syncType: "SHIPMENT", leaseVersion: 2 },
    { syncType: "unknown" },
  ])
    await assert.rejects(
      service.admit(id, id, body),
      (e) => e.getStatus() === 400,
    );
  for (const body of [
    { enabled: true, intervalMinutes: 360 },
    { enabled: "true", intervalMinutes: 60 },
    { enabled: true, intervalMinutes: 60, status: "RUNNING" },
  ])
    await assert.rejects(
      service.configure(id, id, "SHIPMENT", body),
      (e) => e.getStatus() === 400,
    );
  assert.equal(calls, 0);
  assert.deepEqual(syncPagination({}), { page: 1, pageSize: 20 });
  for (const q of [
    { page: ["1"] },
    { page: "01" },
    { pageSize: "101" },
    { page: "2147483647", pageSize: "100" },
    { ownerUserId: id },
  ])
    assert.throws(() => syncPagination(q), SyncError);
});
test("Sync maps only known feature errors, leaves unexpected failures to global filter", async () => {
  const service = new SyncService({
    admit: async () => {
      throw new SyncError("SYNC_UNAVAILABLE");
    },
  });
  await assert.rejects(
    service.admit(id, id, { syncType: "SHIPMENT" }),
    (e) => e.getStatus() === 503 && e.getResponse().code === "SYNC_UNAVAILABLE",
  );
  const fault = Error("synthetic database failure");
  const unexpected = new SyncService({
    admit: async () => {
      throw fault;
    },
  });
  await assert.rejects(
    unexpected.admit(id, id, { syncType: "SHIPMENT" }),
    (e) => e === fault,
  );
});

test("executor bounds a nonresponsive provider, forwards abort and never checkpoints its late result", async () => {
  const {
    SyncJobExecutor,
  } = require("../../dist/sync/application/sync-job-executor.service");
  let written = 0,
    waited,
    signal;
  const queue = {
    config: { leaseSeconds: 60 },
    available: () => true,
    capabilities: { resolve: () => ({ provider, processor: { version: 1 } }) },
    heartbeat: async () => {},
    page: async () => written++,
    wait: async (_job, code) => (waited = code),
  };
  const provider = {
    strategy: () => "FULL",
    fetch: async (_job, s) => {
      signal = s;
      return new Promise(() => {});
    },
  };
  const job = {
    processing_phase: "FETCHING",
    fetch_strategy: "FULL",
    provider: "uniship",
    sync_type: "SHIPMENT",
    attempt_count: 0,
  };
  await new SyncJobExecutor(queue, 20).execute(
    job,
    new globalThis.AbortController().signal,
  );
  assert.equal(written, 0);
  assert.equal(waited, "PROVIDER_RETRY");
  assert.equal(signal.aborted, true);
});
