const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ShipmentAggregate,
  ShipmentError,
  DecimalValue,
} = require("../../dist/shipment/domain/shipment");
const { LogisticsStage: S } = require("@nexora/shared/shipment");
const input = (extra = {}) => ({
  trackingCode: "track",
  providerStatus: "test-unknown",
  ...extra,
});
const line = (extra = {}) => ({
  chargeCode: "DOMESTIC_SHIPPING",
  amount: "15.01",
  currency: "CNY",
  ...extra,
});
const scope = (ownerUserId) => ({
  ownerUserId,
  sourceIdentityId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  carrierConnectionId: null,
  provider: "fixture",
});
const ownerId = "11111111-1111-1111-1111-111111111111";
const prepare = (existing, input, stage) => {
  if (!existing) return ShipmentAggregate.create(scope(ownerId), input, stage);
  const draft = ShipmentAggregate.create(
    scope(ownerId),
    { trackingCode: "stored" },
    existing.logisticsStage,
  );
  const root = ShipmentAggregate.hydrate({
    ...draft.snapshot(),
    id: "22222222-2222-2222-2222-222222222222",
    code: "VD000001",
  });
  root.applyProvider(input, stage);
  return root;
};
const invalid = (fn) =>
  assert.throws(
    fn,
    (e) => e instanceof ShipmentError && e.code === "VALIDATION_ERROR",
  );
test("Shipment decimal VO rejects floats, excess scale/range and preserves exact strings", () => {
  for (const v of [1.2, "1.005", "1e2", "NaN", "10000000000000000", " 1.00"])
    invalid(() => DecimalValue.parse(v, 18, 2));
  assert.equal(
    DecimalValue.parse("9999999999999999.99", 18, 2),
    "9999999999999999.99",
  );
  assert.equal(DecimalValue.parse("-15.1", 18, 2), "-15.10");
});
test("Shipment creation needs no Customer, invents no identity/totals/timestamps and unknown maps UNKNOWN", () => {
  const p = prepare(null, input(), S.UNKNOWN).operation();
  assert.equal(p.fields.trackingCode, "track");
  assert.equal(p.fields.logisticsStage, S.UNKNOWN);
  assert.equal(p.stageChanged, true);
  assert.equal(p.charges, undefined);
  for (const key of [
    "id",
    "code",
    "ownerUserId",
    "customerId",
    "totalAmount",
    "exchangeRateAt",
  ])
    assert.equal(p.fields[key], undefined);
});
test("strict provider commands reject mixed mass assignment and invalid runtime shapes", () => {
  for (const v of [
    null,
    [],
    new Date(),
    input({ customerId: null }),
    input({ internalNote: "overwrite" }),
    input({ ownerUserId: "other" }),
    input({ charges: { complete: false, lines: [] } }),
    input({ charges: null }),
  ])
    invalid(() => prepare(null, v, S.UNKNOWN));
  for (const v of [
    input({ shipmentKind: "BULK" }),
    input({ weightKg: "-0.001" }),
    input({ weightKg: "1.0001" }),
    input({ totalAmount: 12 }),
    input({ packageCount: -1 }),
    input({ totalCurrency: "cnY" }),
  ])
    invalid(() => prepare(null, v, S.UNKNOWN));
  invalid(() => prepare(null, input(), "BAD"));
});
test("complete, missing, empty and invalid charges are distinct; duplicates and source order survive", () => {
  const a = prepare(
    null,
    input({
      charges: {
        complete: true,
        lines: [
          line(),
          line({ amount: "8.00" }),
          line({ chargeCode: "OTHER", providerLabel: "unverified" }),
        ],
      },
    }),
    S.UNKNOWN,
  );
  assert.deepEqual(
    a.operation().charges.map((x) => [x.lineNo, x.chargeCode, x.amount]),
    [
      [1, "DOMESTIC_SHIPPING", "15.01"],
      [2, "DOMESTIC_SHIPPING", "8.00"],
      [3, "OTHER", "15.01"],
    ],
  );
  assert.equal(
    prepare(null, input(), S.UNKNOWN).operation().charges,
    undefined,
  );
  assert.deepEqual(
    prepare(
      null,
      input({ charges: { complete: true, lines: [] } }),
      S.UNKNOWN,
    ).operation().charges,
    [],
  );
  for (const lines of [
    [line({ amount: "1.001" })],
    [line(), line({ chargeCode: "UNVERIFIED" })],
    [line({ currency: null })],
  ])
    invalid(() =>
      prepare(null, input({ charges: { complete: true, lines } }), S.UNKNOWN),
    );
});
test("immutable operation snapshots and mapped-stage comparison protect stored state", () => {
  const source = input({
    totalAmount: "500.00",
    totalCurrency: "CNY",
    charges: { complete: true, lines: [line()] },
  });
  const a = prepare({ logisticsStage: S.UNKNOWN }, source, S.AT_DEST_WAREHOUSE);
  source.charges.lines[0].amount = "0.00";
  const first = a.operation();
  first.fields.totalAmount = "0";
  first.charges[0].amount = "0";
  assert.equal(a.operation().fields.totalAmount, "500.00");
  assert.equal(a.operation().charges[0].amount, "15.01");
  assert.equal(a.operation().stageChanged, true);
  assert.equal(
    prepare({ logisticsStage: S.DELIVERED }, input(), S.DELIVERED).operation()
      .stageChanged,
    false,
  );
});

test("actual root and Charge children preserve identity, ownership and hydrated fees with immutable snapshots", () => {
  const owner = "11111111-1111-1111-1111-111111111111";
  const created = ShipmentAggregate.create(
    scope(owner),
    input({ charges: { complete: true, lines: [line()] } }),
    S.UNKNOWN,
  );
  assert.equal(created.snapshot().ownerUserId, owner);
  assert.equal(created.snapshot().id, null);
  const stored = {
    ...created.snapshot(),
    id: "22222222-2222-2222-2222-222222222222",
    code: "VD000001",
    customerId: "33333333-3333-3333-3333-333333333333",
    internalNote: "human",
    charges: [
      {
        ...created.snapshot().charges[0],
        id: "44444444-4444-4444-4444-444444444444",
      },
    ],
  };
  const root = ShipmentAggregate.hydrate(stored);
  stored.charges[0].amount = "0.00";
  root.applyProvider(input({ trackingCode: "changed" }), S.DELIVERED);
  const snapshot = root.snapshot();
  assert.equal(snapshot.id, "22222222-2222-2222-2222-222222222222");
  assert.equal(snapshot.customerId, "33333333-3333-3333-3333-333333333333");
  assert.equal(snapshot.internalNote, "human");
  assert.equal(snapshot.charges[0].amount, "15.01");
  snapshot.charges.length = 0;
  assert.equal(root.snapshot().charges.length, 1);
  root.applyProvider(
    input({ charges: { complete: true, lines: [line({ amount: "7.77" })] } }),
    S.DELIVERED,
  );
  assert.equal(
    root.snapshot().charges[0].id,
    "44444444-4444-4444-4444-444444444444",
  );
  root.applyProvider(
    input({ charges: { complete: true, lines: [] } }),
    S.DELIVERED,
  );
  assert.deepEqual(root.snapshot().charges, []);
});

test("typed normalized provider input keeps explicit complete marker and owns a validated copy", () => {
  const {
    parseShipmentProviderInput,
  } = require("../../dist/shipment/domain/shipment");
  const raw = input({
    charges: { complete: true, lines: [line({ amount: "1.2" })] },
  });
  const parsed = parseShipmentProviderInput(raw);
  assert.equal(parsed.charges.complete, true);
  assert.equal(parsed.charges.lines[0].amount, "1.20");
  assert.ok(!Object.hasOwn(parsed.charges.lines[0], "lineNo"));
  raw.charges.lines[0].amount = "0.00";
  assert.equal(parsed.charges.lines[0].amount, "1.20");
  assert.ok(
    !Object.hasOwn(
      parseShipmentProviderInput({ providerStatus: "test" }),
      "charges",
    ),
  );
  invalid(() =>
    parseShipmentProviderInput(
      input({ charges: { complete: false, lines: [] } }),
    ),
  );
});
