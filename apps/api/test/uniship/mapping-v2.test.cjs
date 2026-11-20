const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const {
  parseUnishipPage,
  parseUnishipWarehouses,
} = require("../../dist/shipment/infrastructure/uniship/uniship-normalizer");
const { stores, page } = require("../helpers/uniship-fixture.cjs");
const sample = readFileSync(
  resolve(
    __dirname,
    "../fixtures/uniship/mapping-v2/owner-discussion-sample.json",
  ),
  "utf8",
);
const parse = (text, warnings = []) =>
  parseUnishipPage(text, 1, 100, parseUnishipWarehouses(stores), (c) =>
    warnings.push(c),
  ).records[0];
test("owner-discussion sample exact mapping, UTC+7 and zero-valued fees; no total/rate calculation", () => {
  const r = parse(sample);
  assert.equal(r.identity.scheme, "uniship-parcel-v1");
  assert.deepEqual(JSON.parse(r.identity.key), ["341827"]);
  const s = r.payload.shipment;
  assert.equal(s.packageCount, 1);
  assert.equal(s.actualPackageCount, 1);
  assert.equal(s.weightKg, "0.040");
  assert.equal(s.totalAmount, "940.00");
  assert.equal(s.totalCurrency, "VND");
  assert.equal(s.providerPaidAmount, "940.00");
  assert.equal(s.providerRemainingAmount, "0.00");
  assert.equal(s.exchangeRate, "3980.000000");
  assert.equal(s.exchangeRateAt, null);
  assert.equal(s.providerPaidAt, "2026-11-16T23:59:01.000Z");
  assert.equal(s.providerUpdatedAt, "2026-11-17T00:34:50.000Z");
  assert.equal(s.destinationWarehouse, "Kho Hà Nội");
  assert.equal(s.providerChangedAt, undefined);
  const a = s.providerAttributesPatch;
  assert.equal(a.values.originWarehouseId, "19");
  assert.equal(a.values.freightUnitPrice.amount, "23500.00");
  assert.equal(a.values.providerCreatedAt, "2026-11-14T01:23:36.000Z");
  assert.equal(a.values.lastMileMethod, "CPN-VietelPost");
  assert.deepEqual(
    s.chargePatch.lines.map((x) => [x.chargeCode, x.amount, x.currency]),
    [
      ["WEIGHT_FREIGHT", "940.00", "VND"],
      ["INSURANCE", "0.00", "VND"],
      ["WOOD_PACKING", "0.00", "VND"],
      ["BUBBLE_WRAP", "0.00", "VND"],
    ],
  );
  assert.equal(s.charges, undefined);
  assert.equal(s.services, undefined);
  assert.deepEqual(
    s.milestonePatch.entries.map((x) => x.occurredAt),
    [
      "2026-11-14T01:23:36.000Z",
      "2026-11-14T06:28:59.000Z",
      "2026-11-16T07:05:25.000Z",
      "2026-11-17T00:34:50.000Z",
    ],
  );
});
test("fractional/negative/overflow counts and money/date corruption reject only stable-ID record without private payload", () => {
  const base = JSON.parse(sample).data[0];
  for (const change of [
    { NumberOfPack: 1.5 },
    { NumberOfPack: -1 },
    { RealNumberOfPack: 2147483648 },
    { PriceAmount: -1 },
    { TotalPaidAmount: "1" },
    { PaymentDate: "2026-02-30T00:00:00.000" },
    { ModifiedDate: "2026-11-17T24:00:00.000" },
  ]) {
    const warnings = [];
    const r = parse(
      page([{ ...base, ...change, ShippingInfo: "private-marker" }]),
      warnings,
    );
    assert.deepEqual(r.payload, { invalid: true });
    assert.ok(!JSON.stringify([r, warnings]).includes("private-marker"));
  }
});
test("missing/null observations preserve fields; timestamp conflict omits only dispatch; private fields/flags never stage", () => {
  const base = JSON.parse(sample).data[0];
  const warnings = [];
  const r = parse(
    page([
      {
        ...base,
        StoreCNExDate: "2026-11-14T14:28:59.000",
        GuaranteeAmountVND: null,
        FeeShip: 999,
        CheckFeeVND: 999,
        IsFoam: true,
        ShippingInfo: "private-marker",
        FakeCustomerName: "private-marker",
      },
    ]),
    warnings,
  ).payload.shipment;
  assert.equal(r.milestonePatch.entries.length, 3);
  assert.ok(warnings.includes("UNISHIP_ORIGIN_DISPATCH_CONFLICT"));
  assert.ok(!r.chargePatch.lines.some((x) => x.chargeCode === "INSURANCE"));
  assert.equal(r.services, undefined);
  assert.ok(!JSON.stringify(r).includes("private-marker"));
  assert.ok(!JSON.stringify(r).includes("999"));
});
test("unresolved China warehouse ID cannot be staged beside an old resolved name", () => {
  const sourceRow = JSON.parse(sample).data[0];
  const warnings = [];
  const shipment = parse(
    page([{ ...sourceRow, ChinaStoreID: 999999 }]),
    warnings,
  ).payload.shipment;
  assert.equal(shipment.originWarehouse, undefined);
  assert.equal(
    shipment.providerAttributesPatch.values.originWarehouseId,
    undefined,
  );
  assert.equal(
    shipment.providerAttributesPatch.values.freightUnitPrice.amount,
    "23500.00",
  );
  assert.ok(warnings.includes("UNISHIP_REQUIRED_FIELD_MISSING"));
});
test("exact counts accept scientific notation after insignificant leading zeros", () => {
  const distinct = parse(
    sample.replace(/"RealNumberOfPack":\s*1/, '"RealNumberOfPack": 2'),
  ).payload.shipment;
  assert.equal(distinct.packageCount, 1);
  assert.equal(distinct.actualPackageCount, 2);
  for (const lexeme of [
    "1.0",
    "1e0",
    "0.0000000001e10",
    "0.0000000002147483647e19",
  ]) {
    const text = sample.replace(
      /"NumberOfPack":\s*[\d.]+/,
      '"NumberOfPack": ' + lexeme,
    );
    assert.equal(
      parse(text).payload.shipment.packageCount,
      lexeme.includes("2147483647") ? 2147483647 : 1,
    );
  }
});
test("UTC+7 calendar/leap boundaries are independent of server timezone", () => {
  const {
    parseUnishipLocalTimestamp: convert,
  } = require("../../dist/shipment/infrastructure/uniship/uniship-normalizer");
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/New_York", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      assert.equal(
        convert("2024-02-29T00:00:00.001"),
        "2024-02-28T17:00:00.001Z",
      );
      assert.equal(convert("2026-01-01T00:00:00"), "2025-12-31T17:00:00.000Z");
      assert.equal(
        convert("2026-11-20T23:59:59.9"),
        "2026-11-20T16:59:59.900Z",
      );
      for (const bad of [
        "2025-02-29T00:00:00",
        "2024-04-31T12:00:00",
        "2026-11-20T23:59:60",
        "2026-11-20T12:00:00.0000",
        "2026-11-20T12:00:00Z",
      ])
        assert.throws(() => convert(bad));
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
