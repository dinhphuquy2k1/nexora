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
    code: "SHP000001",
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
    code: "SHP000001",
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

test("Shipment hydration requires SHP and at least six digits, preserving the full stored snapshot", () => {
  const created = ShipmentAggregate.create(
    scope(ownerId),
    input({
      totalAmount: "500.00",
      totalCurrency: "CNY",
      charges: { complete: true, lines: [line()] },
    }),
    S.UNKNOWN,
  );
  const stored = {
    ...created.snapshot(),
    id: "22222222-2222-2222-2222-222222222222",
    customerId: "33333333-3333-3333-3333-333333333333",
    internalNote: "Nexora-owned",
    code: "SHP000001",
  };
  for (const code of [
    "SHP000001",
    "SHP000002",
    "SHP000123",
    "SHP999999",
    "SHP1000000",
  ]) {
    const state = { ...stored, code };
    assert.deepEqual(ShipmentAggregate.hydrate(state).snapshot(), state);
  }
  for (const code of [
    "VD000001",
    "SHP00001",
    "SHP000001X",
    "",
    "SHP",
    "shp000001",
    "SHP-000001",
    "SHP000 001",
    " SHP000001",
    "SHP000001 ",
    "SHP000001\n",
    "SHP000001\r",
    "SHP000001\u2028",
    "SHP000001\u2029",
    null,
    1,
  ])
    invalid(() => ShipmentAggregate.hydrate({ ...stored, code }));
  invalid(() => created.applyProvider(input({ code: "SHP000123" }), S.UNKNOWN));
});

test("milestone/item snapshots retain keyed identities, exact unit values and immutable state", () => {
  const m = (milestoneCode, extra = {}) => ({
    milestoneCode,
    occurredAt: "2026-11-14T01:02:03Z",
    ...extra,
  });
  const raw = input({
    milestones: {
      complete: true,
      entries: [
        m("DEST_RECEIVED", { locationName: "Dest" }),
        m("ORIGIN_RECEIVED"),
      ],
    },
    items: {
      complete: true,
      lines: [
        {
          name: "Product",
          quantity: 0,
          unitValue: "1234567890123456.78",
          currency: "CNY",
        },
        { name: "No value" },
      ],
    },
  });
  const created = ShipmentAggregate.create(scope(ownerId), raw, S.UNKNOWN);
  raw.items.lines[0].name = "outside";
  raw.milestones.entries[0].locationName = "outside";
  const state = created.snapshot();
  assert.deepEqual(
    state.milestones.map((x) => x.milestoneCode),
    ["ORIGIN_RECEIVED", "DEST_RECEIVED"],
  );
  assert.equal(state.milestones[1].occurredAt, "2026-11-14T01:02:03.000Z");
  assert.equal(state.items[0].name, "Product");
  assert.equal(state.items[0].unitValue, "1234567890123456.78");
  assert.equal(state.items[1].unitValue, null);
  assert.equal(state.items[1].currency, null);
  const stored = {
    ...state,
    id: "22222222-2222-2222-2222-222222222222",
    code: "SHP000001",
    milestones: state.milestones.map((x, i) => ({
      ...x,
      id: i
        ? "55555555-5555-5555-5555-555555555555"
        : "44444444-4444-4444-4444-444444444444",
    })),
    items: state.items.map((x) => ({
      ...x,
      id: "66666666-6666-6666-6666-666666666666",
    })),
  };
  const root = ShipmentAggregate.hydrate(stored);
  root.applyProvider(input({ trackingCode: "kept" }), S.UNKNOWN);
  assert.deepEqual(root.snapshot().milestones, stored.milestones);
  assert.deepEqual(root.snapshot().items, stored.items);
  root.applyProvider(
    input({
      milestones: {
        complete: true,
        entries: [m("DEST_RECEIVED", { locationName: "New" })],
      },
      items: {
        complete: true,
        lines: [{ name: "Changed", unitValue: "1.2", currency: "JPY" }],
      },
    }),
    S.UNKNOWN,
  );
  assert.equal(
    root.snapshot().milestones[0].id,
    "55555555-5555-5555-5555-555555555555",
  );
  assert.equal(
    root.snapshot().items[0].id,
    "66666666-6666-6666-6666-666666666666",
  );
  assert.equal(root.snapshot().items[0].unitValue, "1.20");
  const outside = root.snapshot();
  outside.items[0].name = "bad";
  outside.milestones[0].locationName = "bad";
  const op = root.operation();
  op.items[0].unitValue = "0.00";
  assert.equal(root.snapshot().items[0].name, "Changed");
  assert.equal(root.operation().items[0].unitValue, "1.20");
  const before = root.snapshot();
  invalid(() =>
    root.applyProvider(
      input({
        trackingCode: "must-not-write",
        milestones: { complete: true, entries: [] },
        items: { complete: true, lines: [{ name: "x", quantity: -1 }] },
      }),
      S.UNKNOWN,
    ),
  );
  assert.deepEqual(root.snapshot(), before);
  root.applyProvider(
    input({
      milestones: { complete: true, entries: [] },
      items: { complete: true, lines: [] },
    }),
    S.UNKNOWN,
  );
  assert.deepEqual(root.snapshot().milestones, []);
  assert.deepEqual(root.snapshot().items, []);
});
test("milestone/item strict boundaries reject invalid snapshots and money pairs", () => {
  const milestone = {
    milestoneCode: "ORIGIN_RECEIVED",
    occurredAt: "2026-11-14T01:02:03Z",
  };
  for (const milestones of [
    null,
    { complete: false, entries: [] },
    { complete: true, entries: [{ ...milestone, milestoneCode: "BAD" }] },
    { complete: true, entries: [milestone, milestone] },
    { complete: true, entries: Array(5).fill(milestone) },
    {
      complete: true,
      entries: [{ ...milestone, occurredAt: "2026-02-30T00:00:00Z" }],
    },
    { complete: true, entries: [{ ...milestone, occurredAt: null }] },
    {
      complete: true,
      entries: [{ ...milestone, locationName: "x".repeat(257) }],
    },
    { complete: true, entries: [{ ...milestone, extra: true }] },
  ])
    invalid(() =>
      ShipmentAggregate.create(
        scope(ownerId),
        input({ milestones }),
        S.UNKNOWN,
      ),
    );
  for (const item of [
    { name: " " },
    { name: "x".repeat(513) },
    { name: "x", quantity: -1 },
    { name: "x", quantity: 1.1 },
    { name: "x", quantity: 2147483648 },
    { name: "x", lineNo: 1 },
    { name: "x", unitValue: "1.00" },
    { name: "x", currency: "CNY" },
    { name: "x", unitValue: "-1.00", currency: "CNY" },
    { name: "x", unitValue: 1, currency: "CNY" },
    { name: "x", unitValue: "10000000000000000", currency: "CNY" },
    { name: "x", unitValue: "1.001", currency: "CNY" },
    { name: "x", unitValue: "1", currency: "cnY" },
  ])
    invalid(() =>
      ShipmentAggregate.create(
        scope(ownerId),
        input({ items: { complete: true, lines: [item] } }),
        S.UNKNOWN,
      ),
    );
  for (const items of [
    null,
    { complete: false, lines: [] },
    { complete: true, lines: Array(32768).fill({ name: "x" }) },
    { complete: true, lines: [], extra: true },
  ])
    invalid(() =>
      ShipmentAggregate.create(scope(ownerId), input({ items }), S.UNKNOWN),
    );
  const valid = ShipmentAggregate.create(
    scope(ownerId),
    input({
      items: {
        complete: true,
        lines: [
          { name: "x", quantity: 2147483647, unitValue: null, currency: null },
        ],
      },
    }),
    S.UNKNOWN,
  );
  assert.equal(valid.snapshot().items[0].quantity, 2147483647);
  const state = {
    ...valid.snapshot(),
    id: "22222222-2222-2222-2222-222222222222",
    code: "SHP000001",
  };
  invalid(() =>
    ShipmentAggregate.hydrate({
      ...state,
      items: [{ ...state.items[0], unitValue: "1.00", currency: null }],
    }),
  );
});
