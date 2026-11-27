const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  readUnishipSyncConfig,
  allowsUnishipActivation,
} = require("../dist/sync/infrastructure/uniship-sync.config");
const {
  readCarrierRuntimeConfig,
} = require("../dist/carrier/infrastructure/carrier-runtime.config");
const owner = "00000000-0000-4000-8000-000000000001",
  connection = "00000000-0000-4000-8000-000000000002";
const policy = {
  ownerUserId: owner,
  externalAccountId: "123",
  loginIdentifier: "synthetic",
  mode: "MANUAL_ONLY",
};
const context = {
  ownerUserId: owner,
  connectionId: connection,
  provider: "uniship",
  externalAccountId: "123",
  loginIdentifier: "synthetic",
};
function env(p = policy) {
  return { UNISHIP_ACTIVATION_POLICY_JSON: JSON.stringify(p) };
}
test("Carrier runtime parser shares URL/live/NODE_ENV semantics without API storage or Identity settings", () => {
  assert.deepEqual(readCarrierRuntimeConfig({}), {
    apiUrl: undefined,
    liveAuthorized: false,
    isProduction: false,
  });
  assert.equal(
    readCarrierRuntimeConfig({ UNISHIP_API_URL: "", NODE_ENV: "production" })
      .apiUrl,
    undefined,
  );
  assert.equal(
    readCarrierRuntimeConfig({
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "true",
    }).liveAuthorized,
    true,
  );
  for (const change of [
    { UNISHIP_API_URL: "private-invalid" },
    { UNISHIP_API_URL: "ftp://example.invalid" },
    { NODE_ENV: "wrong" },
    { UNISHIP_LIVE_AUTHORIZED: "yes" },
  ])
    assert.throws(() => readCarrierRuntimeConfig(change), /configuration/i);
});
test("Activation policy is absent-OFF, strict, frozen and never changes onboarding schedule intent", () => {
  assert.equal(readUnishipSyncConfig({}).activation, undefined);
  const { activation } = readUnishipSyncConfig(env());
  assert.equal(Object.isFrozen(activation), true);
  assert.equal(allowsUnishipActivation(activation, context, "MANUAL"), true);
  assert.equal(allowsUnishipActivation(activation, context, "AUTO", 60), false);
  for (const change of [
    { ownerUserId: connection },
    { externalAccountId: "124" },
    { loginIdentifier: "other" },
    { provider: "other" },
    { connectionId: owner },
  ])
    assert.equal(
      allowsUnishipActivation(
        { ...activation, connectionId: connection },
        { ...context, ...change },
        "MANUAL",
      ),
      false,
    );
  const auto = { ...activation, mode: "AUTOMATIC" };
  for (const interval of [15, 30, undefined])
    assert.equal(
      allowsUnishipActivation(auto, context, "AUTO", interval),
      false,
    );
  for (const interval of [60, 120, 240])
    assert.equal(
      allowsUnishipActivation(auto, context, "AUTO", interval),
      true,
    );
  assert.equal(allowsUnishipActivation(auto, context, "MANUAL", 15), true);
  for (const value of [
    "{private",
    "null",
    "[]",
    JSON.stringify({ ...policy, extra: true }),
    JSON.stringify({ ...policy, mode: "ON" }),
    JSON.stringify({ ...policy, ownerUserId: "bad" }),
    JSON.stringify({ ...policy, externalAccountId: "0" }),
    JSON.stringify({ ...policy, connectionId: null }),
  ])
    assert.throws(
      () => readUnishipSyncConfig({ UNISHIP_ACTIVATION_POLICY_JSON: value }),
      (e) => /configuration/i.test(e.message) && !e.message.includes("private"),
    );
});
test("Reconciliation JSON delegates existing strict int32/BPS policy, has no defaults and never logs input", () => {
  for (const raw of [undefined, "", "  "])
    assert.equal(
      readUnishipSyncConfig({ UNISHIP_RECONCILIATION_POLICY_JSON: raw })
        .reconciliation,
      undefined,
    );
  const p = {
    maxNewlyMissing: 2147483647,
    maxMissingRatioBps: 10000,
    maxObservedDropRatioBps: 0,
  };
  const result = readUnishipSyncConfig({
    UNISHIP_RECONCILIATION_POLICY_JSON: JSON.stringify(p),
  }).reconciliation;
  assert.deepEqual(result, p);
  assert.equal(Object.isFrozen(result), true);
  for (const value of [
    "{private",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...p, extra: 1 }),
    JSON.stringify({ ...p, maxNewlyMissing: 2147483648 }),
    JSON.stringify({ ...p, maxMissingRatioBps: 10001 }),
    JSON.stringify({ ...p, maxObservedDropRatioBps: -1 }),
    JSON.stringify({ ...p, maxNewlyMissing: 0.1 }),
  ])
    assert.throws(
      () =>
        readUnishipSyncConfig({ UNISHIP_RECONCILIATION_POLICY_JSON: value }),
      (e) => /configuration/i.test(e.message) && !e.message.includes("private"),
    );
});
