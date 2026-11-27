const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const {
  UnishipSyncRuntime,
} = require("../dist/sync/infrastructure/uniship-sync.runtime");
const owner = "00000000-0000-4000-8000-000000000001";
const policy = JSON.stringify({
  ownerUserId: owner,
  externalAccountId: "123",
  loginIdentifier: "synthetic",
  mode: "MANUAL_ONLY",
});
const key = randomBytes(32).toString("base64");
const valid = {
  NODE_ENV: "test",
  SYNC_ENABLED: "true",
  UNISHIP_API_URL: "http://127.0.0.1:9",
  UNISHIP_ACTIVATION_POLICY_JSON: policy,
  CARRIER_KEYRING_JSON: JSON.stringify({ 1: key }),
  CARRIER_ACTIVE_KEY_VERSION: "1",
};
function runtime(mode, env) {
  return new UnishipSyncRuntime(
    `postgresql://${mode === "worker" ? "nexora_sync" : "nexora_app"}:unused@127.0.0.1/unused`,
    env,
    mode,
  );
}
test("shared API/Worker declaration has exact FULL/100/processor1/reconciliation1 contract in authorized mock runtime", async () => {
  const a = runtime("api", valid),
    w = runtime("worker", valid);
  try {
    for (const r of [a, w]) {
      const cap = r.capabilities.resolve("uniship", "SHIPMENT");
      assert.ok(cap);
      assert.equal(cap.strategy, "FULL");
      assert.equal(cap.fullScan.pageSize, 100);
      assert.equal(cap.fullScan.sourceKeyScheme, "uniship-parcel-v1");
      assert.equal(cap.processor.version, 1);
      assert.equal(cap.domain.finalizationVersion, 1);
      assert.equal(r.capabilities.resolve("uniship", "CUSTOMER"), null);
      assert.equal(r.capabilities.resolve("other", "SHIPMENT"), null);
    }
  } finally {
    await Promise.all([a.onApplicationShutdown(), w.onApplicationShutdown()]);
  }
});
test("global OFF, missing scope or Carrier key and all unverified external/production targets remain unavailable", async () => {
  for (const env of [
    {},
    { ...valid, SYNC_ENABLED: "false" },
    { ...valid, UNISHIP_ACTIVATION_POLICY_JSON: "" },
    { ...valid, CARRIER_KEYRING_JSON: "" },
    { ...valid, NODE_ENV: "production" },
    {
      ...valid,
      NODE_ENV: "production",
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "true",
    },
    {
      ...valid,
      UNISHIP_API_URL: "https://other.invalid",
      UNISHIP_LIVE_AUTHORIZED: "true",
    },
  ]) {
    const r = runtime("worker", env);
    try {
      assert.equal(r.capabilities.resolve("uniship", "SHIPMENT"), null);
    } finally {
      await r.onApplicationShutdown();
    }
  }
  assert.throws(
    () =>
      new UnishipSyncRuntime(
        "postgresql://postgres:unused@127.0.0.1/unused",
        valid,
        "worker",
      ),
    /custody/i,
  );
});
