const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ShipmentSyncProcessor,
} = require("../../dist/shipment/application/shipment-sync.processor");
const { LogisticsStage: S } = require("@nexora/shared/shipment");
test("Shipment processor uses injected synthetic mappings; unknown is not human review", async () => {
  let observed;
  const p = new ShipmentSyncProcessor(2, { synthetic: S.DELIVERED }, () => {});
  const session = {
    existingProviderStatus: null,
    propose: async (payload, stage) => {
      observed = { payload, stage };
    },
  };
  assert.deepEqual(
    await p.apply(
      { payload: { trackingCode: "t", providerStatus: "synthetic" } },
      session,
    ),
    { outcome: "APPLIED" },
  );
  assert.equal(observed.stage, S.DELIVERED);
  await p.apply(
    { payload: { trackingCode: "t", providerStatus: "unknown" } },
    session,
  );
  assert.equal(observed.stage, S.UNKNOWN);
  const { ShipmentError } = require("../../dist/shipment/domain/shipment");
  session.propose = async () => {
    throw new ShipmentError("VALIDATION_ERROR");
  };
  assert.deepEqual(await p.apply({ payload: {} }, session), {
    outcome: "REJECTED_SOURCE",
    code: "SOURCE_INVALID",
  });
  session.propose = async () => {
    throw Error("database failure");
  };
  await assert.rejects(p.apply({ payload: {} }, session), /database failure/);
});
