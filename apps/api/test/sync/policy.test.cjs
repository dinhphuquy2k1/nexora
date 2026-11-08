const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  loadSyncConfig,
  sourceKey,
  canonicalPayload,
  SyncError,
} = require("../../dist/sync/domain/sync-policy");
test("Sync flags fail closed and source identity preserves provider field semantics", () => {
  assert.equal(loadSyncConfig({}).enabled, false);
  assert.throws(() => loadSyncConfig({ SYNC_ENABLED: "yes" }));
  assert.notEqual(
    sourceKey("v1", ["A-B", "C"]).hash,
    sourceKey("v1", ["A", "B-C"]).hash,
  );
  assert.notEqual(sourceKey("v1", [" A"]).key, sourceKey("v1", ["A"]).key);
  assert.notEqual(sourceKey("v1", ["e\u0301"]).key, sourceKey("v1", ["é"]).key);
  for (const fields of [[null], [""], [12], ["x".repeat(513)], []])
    assert.throws(() => sourceKey("v1", fields), SyncError);
});
test("Canonical payload is deterministic, bounded and rejects non-JSON values", () => {
  assert.equal(
    canonicalPayload({ b: 2, a: "x" }),
    canonicalPayload({ a: "x", b: 2 }),
  );
  assert.notEqual(canonicalPayload({ a: "2" }), canonicalPayload({ a: 2 }));
  for (const v of [{ x: NaN }, { x: undefined }, { x: BigInt(1) }, new Date()])
    assert.throws(() => canonicalPayload(v));
});

test("Sync retry honors a valid long Retry-After and rejects non-finite scheduling delays", () => {
  const { retryDelay } = require("../../dist/sync/domain/sync-policy");
  assert.equal(retryDelay(0, 3600000), 3600000);
  assert.equal(retryDelay(30, NaN), 60000);
  assert.equal(retryDelay(0, Infinity), 1000);
});
