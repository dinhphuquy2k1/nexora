const test = require("node:test");
const assert = require("node:assert/strict");
const {
  decideShipmentReconciliation,
  nextMissingStreak,
  reconciliationPolicy,
} = require("../../dist/shipment/domain/shipment-reconciliation");
const policy = {
  maxNewlyMissing: 5,
  maxMissingRatioBps: 5000,
  maxObservedDropRatioBps: 5000,
};
const facts = {
  admitted: true,
  eligible: true,
  scopeMatches: true,
  fingerprint: "scope",
  baseline: { fingerprint: "scope", observed: 3 },
  eligibleShipments: 3,
  currentlyVisible: 3,
  newlyMissing: 1,
  alreadyHiddenMissing: 0,
  restorable: 0,
  maxMissingStreak: 0,
  conflicts: 0,
  currentObserved: 2,
};
test("Shipment reconciliation separates technical integrity, bootstrap and safety", () => {
  assert.equal(decideShipmentReconciliation(facts, policy).status, "APPLIED");
  for (const [change, config, status, reason] of [
    [
      { baseline: { fingerprint: "old", observed: 3 }, currentObserved: 0 },
      policy,
      "SKIPPED",
      "SCOPE_MISMATCH",
    ],
    [{ admitted: false }, policy, "SKIPPED", "CAPABILITY_NOT_ADMITTED"],
    [{ eligible: false }, policy, "SKIPPED", "SCAN_NOT_VALIDATED"],
    [{ scopeMatches: false }, policy, "SKIPPED", "SCOPE_MISMATCH"],
    [{}, undefined, "SKIPPED", "POLICY_NOT_CONFIGURED"],
    [{ baseline: null }, policy, "BASELINE_ESTABLISHED", null],
    [
      { baseline: null, currentObserved: 0 },
      policy,
      "SKIPPED",
      "ZERO_RESULT_ANOMALY",
    ],
    [
      {
        baseline: null,
        eligibleShipments: 0,
        currentlyVisible: 0,
        newlyMissing: 0,
        currentObserved: 0,
      },
      policy,
      "BASELINE_ESTABLISHED",
      null,
    ],
    [
      {
        baseline: { fingerprint: "old", observed: 3 },
        alreadyHiddenMissing: 1,
      },
      policy,
      "SKIPPED",
      "SCOPE_MISMATCH",
    ],
    [
      { baseline: { fingerprint: "old", observed: 3 } },
      policy,
      "SKIPPED",
      "SCOPE_MISMATCH",
    ],
    [
      { baseline: null, restorable: 1 },
      policy,
      "SKIPPED",
      "BASELINE_UNAVAILABLE",
    ],
    [{ newlyMissing: 6 }, policy, "SKIPPED", "MASS_HIDE_THRESHOLD_EXCEEDED"],
    [{ currentObserved: 1 }, policy, "SKIPPED", "MASS_HIDE_THRESHOLD_EXCEEDED"],
    [{ conflicts: 1 }, policy, "SKIPPED", "SOURCE_SCOPE_CONFLICT"],
    [
      { alreadyHiddenMissing: 1, maxMissingStreak: 2147483647 },
      policy,
      "SKIPPED",
      "STREAK_LIMIT_REACHED",
    ],
  ]) {
    const decision = decideShipmentReconciliation(
      { ...facts, ...change },
      config,
    );
    assert.equal(decision.status, status);
    assert.equal(decision.reason, reason);
    if (status !== "APPLIED")
      assert.deepEqual(
        [decision.newlyHidden, decision.restored, decision.stillMissing],
        [0, 0, 0],
      );
  }
});
test("visibility streaks and explicit test-only safety configuration are bounded", () => {
  assert.equal(nextMissingStreak(0), 1);
  assert.equal(nextMissingStreak(1), 2);
  assert.equal(nextMissingStreak(2147483646), 2147483647);
  for (const n of [-1, 1.5, 2147483647])
    assert.throws(() => nextMissingStreak(n));
  const config = reconciliationPolicy(policy);
  assert.equal(Object.isFrozen(config), true);
  for (const bad of [
    null,
    {},
    { ...policy, maxNewlyMissing: -1 },
    { ...policy, maxMissingRatioBps: 10001 },
    { ...policy, maxObservedDropRatioBps: NaN },
    { ...policy, extra: 1 },
  ])
    assert.equal(reconciliationPolicy(bad), undefined);
});
