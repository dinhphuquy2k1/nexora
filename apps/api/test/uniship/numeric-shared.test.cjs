const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const {
  DecimalValue,
  ShipmentError,
} = require("../../dist/shipment/domain/shipment");
const {
  UnishipShipmentProcessor,
} = require("../../dist/shipment/infrastructure/uniship/uniship-shipment.processor");
const fixture = JSON.parse(
  readFileSync(
    resolve(
      __dirname,
      "../../../../packages/shared/test/fixtures/numeric-parity.json",
    ),
    "utf8",
  ),
);
test("Domain facade retains exact baseline outputs and VALIDATION_ERROR classification", () => {
  for (const row of fixture.cases)
    for (const d of row.decimals) {
      if (d.result === null)
        assert.throws(
          () => DecimalValue.parse(row.source, d.precision, d.scale),
          (e) => e instanceof ShipmentError && e.code === "VALIDATION_ERROR",
        );
      else
        assert.equal(
          DecimalValue.parse(row.source, d.precision, d.scale),
          d.result,
        );
    }
});
test("Uniship mapping V2 uses the development processor version 1", () => {
  assert.equal(new UnishipShipmentProcessor().version, 1);
  // Generic upgrades remain supported and are covered by existing fence/reprocessing tests.
  assert.equal(new UnishipShipmentProcessor(5).version, 5);
});
