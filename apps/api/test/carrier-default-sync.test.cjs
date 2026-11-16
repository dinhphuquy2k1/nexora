const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CarrierProvider } = require("../dist/carrier/domain/carrier");
const policy = () =>
  require("../dist/carrier/domain/default-sync-policy").getDefaultSyncPolicies;
test("Uniship onboarding defaults are exactly one enabled SHIPMENT at60 minutes", () => {
  const resolve = policy();
  const defaults = resolve(CarrierProvider.UNISHIP);
  assert.deepEqual(defaults, [
    { syncType: "SHIPMENT", enabled: true, intervalMinutes: 60 },
  ]);
  assert.equal(new Set(defaults.map((d) => d.syncType)).size, defaults.length);
});
test("onboarding policy never assigns Uniship defaults to another provider", () => {
  for (const provider of ["", "future-provider", "UNISHIP", "toString"])
    assert.deepEqual(policy()(provider), []);
});
test("onboarding defaults are immutable across callers", () => {
  const resolve = policy();
  const defaults = resolve(CarrierProvider.UNISHIP);
  assert.equal(Object.isFrozen(defaults), true);
  assert.equal(Object.isFrozen(defaults[0]), true);
  assert.throws(() =>
    defaults.push({ syncType: "CUSTOMER", enabled: true, intervalMinutes: 15 }),
  );
  defaults[0].enabled = false;
  assert.equal(resolve(CarrierProvider.UNISHIP)[0].enabled, true);
  assert.throws(() => resolve("other").push(defaults[0]));
});
