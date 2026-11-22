import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  parseNonNegativeInt32,
  parseUnsignedIntegerText,
  parseUnsignedSafeInteger,
  isDecimalString,
  parseExactDecimal,
} = require("@nexora/shared/numeric");
const { ShipmentWeightUnit } = require("@nexora/shared/shipment");
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/numeric-parity.json", import.meta.url),
    "utf8",
  ),
);
test("numeric extraction preserves baseline algorithms and distinct grammars", () => {
  for (const row of fixture.cases) {
    assert.equal(
      parseNonNegativeInt32(row.source),
      row.count,
      `count ${JSON.stringify(row.source)}`,
    );
    assert.equal(parseUnsignedIntegerText(row.source), row.integerText);
    assert.equal(parseUnsignedSafeInteger(row.source), row.safeInteger);
    assert.equal(isDecimalString(row.source), row.lexical);
    for (const d of row.decimals)
      assert.equal(
        parseExactDecimal(row.source, d.precision, d.scale),
        d.result,
      );
  }
});
test("numeric helpers reject non-text and preserve exact boundaries without coercion", () => {
  for (const value of [
    null,
    undefined,
    1,
    0,
    -0,
    1n,
    {},
    [],
    true,
    new String("1"),
  ]) {
    assert.equal(parseNonNegativeInt32(value), null);
    assert.equal(parseUnsignedIntegerText(value), null);
    assert.equal(parseUnsignedSafeInteger(value), null);
    assert.equal(isDecimalString(value), false);
    assert.equal(parseExactDecimal(value, 18, 2), null);
  }
  assert.equal(parseNonNegativeInt32("2147483647"), 2147483647);
  assert.equal(parseNonNegativeInt32("2147483648"), null);
  assert.equal(parseNonNegativeInt32("1.0e3"), 1000);
  assert.equal(parseUnsignedIntegerText("1.0e3"), null);
  assert.equal(parseUnsignedSafeInteger("9007199254740993"), null);
  assert.equal(
    parseExactDecimal("9007199254740993.01", 18, 2),
    "9007199254740993.01",
  );
  assert.equal(parseExactDecimal("-0.00", 18, 2), "0.00");
  assert.equal(ShipmentWeightUnit.KILOGRAM, "kg");
  assert.deepEqual(Object.values(ShipmentWeightUnit), ["kg"]);
});
