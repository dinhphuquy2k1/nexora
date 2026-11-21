const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const normalizer = require("../../dist/shipment/infrastructure/uniship/uniship-normalizer");
const { stores, page } = require("../helpers/uniship-fixture.cjs");
const fixture = (name) =>
  readFileSync(
    resolve(__dirname, "../fixtures/uniship/mapping-v2", name),
    "utf8",
  );
const parse = (text) =>
  normalizer.parseUnishipPage(
    text,
    1,
    100,
    normalizer.parseUnishipWarehouses(stores),
    () => {},
  ).records[0];
const row = (change) =>
  page([
    { ID: 343558, TransactionCode: "REVIEW-REDACTED", Status: 4, ...change },
  ]);
test("owner clock evidence means UTC with no seven-hour/day shift", () => {
  for (const zone of ["UTC", "Asia/Ho_Chi_Minh", "America/New_York"]) {
    const old = process.env.TZ;
    try {
      process.env.TZ = zone;
      assert.equal(
        normalizer.parseUnishipUtcTimestamp("2026-11-20T03:03:16"),
        "2026-11-20T03:03:16.000Z",
      );
      assert.equal(
        normalizer.parseUnishipUtcTimestamp("2026-11-19T18:30:00"),
        "2026-11-19T18:30:00.000Z",
      );
    } finally {
      if (old === undefined) delete process.env.TZ;
      else process.env.TZ = old;
    }
  }
});
test("343558 owner-selected facts map four independent services, CNY value and one item", () => {
  const s = parse(fixture("owner-parcel-343558.json")).payload.shipment;
  assert.deepEqual(s.services, {
    complete: true,
    entries: ["INSURANCE", "COUNTING", "FRAGILE_GOODS", "FOAM"].map(
      (serviceCode) => ({ serviceCode, enabled: true }),
    ),
  });
  assert.equal(s.declaredValue, "1000.00");
  assert.equal(s.declaredCurrency, "CNY");
  assert.equal(s.itemCount, 23);
  assert.deepEqual(s.items, {
    complete: true,
    lines: [{ name: "A", quantity: null, unitValue: null, currency: null }],
  });
  assert.equal(s.providerUpdatedAt, "2026-11-20T03:19:58.000Z");
});
test("numeric flags distinguish enabled/disabled/unknown and reject every other shape", () => {
  const fields = ["IsGuarantee", "IsCheck", "IsFragileGoods", "IsFoam"];
  const codes = ["INSURANCE", "COUNTING", "FRAGILE_GOODS", "FOAM"];
  for (let i = 0; i < fields.length; i++) {
    for (const value of [0, 1])
      assert.deepEqual(
        parse(row({ [fields[i]]: value })).payload.shipment.services,
        {
          complete: true,
          entries: [{ serviceCode: codes[i], enabled: value === 1 }],
        },
      );
    for (const value of [null, undefined])
      assert.equal(
        parse(row({ [fields[i]]: value })).payload.shipment.services,
        undefined,
      );
    for (const value of [true, false, "1", "0", 2, -1, 0.5, {}, []])
      assert.deepEqual(parse(row({ [fields[i]]: value })).payload, {
        invalid: true,
      });
  }
  const s = parse(
    row({
      IsGuarantee: 0,
      IsCheck: null,
      GuaranteeAmountVND: 500,
      CheckFeeVND: 0,
    }),
  ).payload.shipment;
  assert.deepEqual(s.services.entries, [
    { serviceCode: "INSURANCE", enabled: false },
  ]);
  assert.deepEqual(
    s.chargePatch.lines.map((x) => [x.chargeCode, x.amount]),
    [
      ["INSURANCE", "500.00"],
      ["COUNTING", "0.00"],
    ],
  );
});
test("product and counting facts preserve null/blank omission, exact zero and strict validation", () => {
  for (const value of [null, undefined, "", " \t "])
    assert.equal(
      parse(row({ ProductName: value })).payload.shipment.items,
      undefined,
    );
  const s = parse(
    row({ ProductName: "  A  ", ProductAmount: 0, ProductNumber: 0 }),
  ).payload.shipment;
  assert.equal(s.items.lines[0].name, "  A  ");
  assert.equal(s.declaredValue, "0.00");
  assert.equal(s.itemCount, 0);
  assert.equal(s.items.lines[0].quantity, null);
  assert.equal(s.items.lines[0].unitValue, null);
  for (const change of [
    { ProductName: 1 },
    { ProductAmount: -1 },
    { ProductAmount: "1000" },
    { ProductNumber: 1.5 },
    { ProductNumber: 2147483648 },
    { ProductNumber: -1 },
    { CheckFeeVND: -1 },
  ])
    assert.deepEqual(parse(row(change)).payload, { invalid: true });
  const zero = parse(fixture("derived-delivered-counting-zero.json")).payload
    .shipment;
  assert.deepEqual(zero.chargePatch.lines, [
    { chargeCode: "COUNTING", amount: "0.00", currency: "VND" },
  ]);
  assert.equal(zero.services, undefined);
  const excluded = parse(
    row({
      FeeShip: 99,
      FeeShipVN: 99,
      FeeOther: 99,
      CheckFee: 99,
      GuaranteeAmount: 99,
      FragileFee: 99,
      FoamFee: 99,
    }),
  ).payload.shipment;
  assert.equal(excluded.chargePatch, undefined);
  assert.equal(excluded.services, undefined);
});
