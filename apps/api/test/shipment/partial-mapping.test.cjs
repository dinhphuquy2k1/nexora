const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ShipmentAggregate,
  parseShipmentProviderInput,
  parseShipmentProviderAttributes,
} = require("../../dist/shipment/domain/shipment");
const { LogisticsStage: S } = require("@nexora/shared/shipment");
const uuid = (n) => `${String(n).padStart(8, "0")}-1111-4111-8111-111111111111`;
const scope = {
  ownerUserId: uuid(1),
  sourceIdentityId: uuid(2),
  carrierConnectionId: null,
  provider: "uniship",
};
const charge = (chargeCode, amount = "1.00") => ({
  chargeCode,
  amount,
  currency: "VND",
});
function stored(input = {}) {
  const state = ShipmentAggregate.create(
    scope,
    { trackingCode: "mapped", ...input },
    S.DELIVERED,
  ).snapshot();
  return ShipmentAggregate.hydrate({
    ...state,
    id: uuid(3),
    code: "SHP000001",
    customerId: uuid(99),
    internalNote: "keep",
    charges: state.charges.map((c, i) => ({ ...c, id: uuid(10 + i) })),
    milestones: state.milestones.map((m, i) => ({ ...m, id: uuid(60 + i) })),
  });
}
test("scoped fees retain unrelated rows, IDs/order/labels; zero is upsert not additive and null absence is preservation", () => {
  const root = stored({
    charges: {
      complete: true,
      lines: [
        { ...charge("OTHER"), providerLabel: "untouched" },
        charge("INSURANCE", "3.00"),
      ],
    },
  });
  const before = root.snapshot();
  root.applyProvider(
    {
      chargePatch: {
        lines: [charge("INSURANCE", "0"), charge("WEIGHT_FREIGHT", "940")],
      },
    },
    S.DELIVERED,
  );
  const next = root.snapshot();
  assert.deepEqual(next.charges[0], before.charges[0]);
  assert.equal(next.charges[1].id, before.charges[1].id);
  assert.equal(next.charges[1].amount, "0.00");
  assert.equal(next.charges[2].lineNo, 3);
  assert.equal(next.internalNote, "keep");
  assert.equal(next.customerId, uuid(99));
  assert.equal(root.operation().stageChanged, false);
  root.applyProvider(
    {
      chargePatch: {
        lines: [charge("INSURANCE", "0"), charge("WEIGHT_FREIGHT", "940")],
      },
    },
    S.DELIVERED,
  );
  assert.equal(root.snapshot().charges.length, 3);
  assert.equal(root.snapshot().charges[2].amount, "940.00");
  root.applyProvider({}, S.DELIVERED);
  assert.deepEqual(root.snapshot().charges, next.charges);
});
test("ambiguous code rejects atomically; malformed patches and complete+patch are rejected", () => {
  const root = stored({
    charges: {
      complete: true,
      lines: [charge("INSURANCE"), charge("INSURANCE")],
    },
  });
  const before = root.snapshot();
  assert.throws(
    () =>
      root.applyProvider(
        {
          destinationWarehouse: "do not apply",
          chargePatch: { lines: [charge("INSURANCE", "0")] },
        },
        S.DELIVERED,
      ),
    /CHARGE_PATCH_AMBIGUOUS/,
  );
  assert.deepEqual(root.snapshot(), before);
  for (const input of [
    { charges: { complete: true, lines: [] }, chargePatch: { lines: [] } },
    { chargePatch: { lines: [charge("OTHER")] } },
    { chargePatch: { lines: [charge("INSURANCE"), charge("INSURANCE")] } },
    { chargePatch: { lines: [{ ...charge("FOAM"), unknown: 1 }] } },
  ])
    assert.throws(() => parseShipmentProviderInput(input));
  const full = stored({
    charges: { complete: true, lines: [charge("OTHER")] },
  });
  full.applyProvider({ charges: { complete: true, lines: [] } }, S.DELIVERED);
  assert.deepEqual(full.snapshot().charges, []);
});
test("patch capacity rejects append at50, allows existing target update, keeps milestone IDs and omitted locations", () => {
  const root = stored({
    charges: {
      complete: true,
      lines: Array.from({ length: 50 }, (_, i) =>
        charge(i ? "OTHER" : "INSURANCE"),
      ),
    },
    milestones: {
      complete: true,
      entries: [
        {
          milestoneCode: "DEST_RECEIVED",
          occurredAt: "2026-11-16T07:05:25.000Z",
          locationName: "keep",
        },
      ],
    },
  });
  assert.throws(() =>
    root.applyProvider(
      { chargePatch: { lines: [charge("WEIGHT_FREIGHT")] } },
      S.DELIVERED,
    ),
  );
  root.applyProvider(
    {
      chargePatch: { lines: [charge("INSURANCE", "0")] },
      milestonePatch: {
        entries: [
          {
            milestoneCode: "ORIGIN_RECEIVED",
            occurredAt: "2026-11-14T01:23:36.000Z",
          },
        ],
      },
    },
    S.DELIVERED,
  );
  const old = root
    .snapshot()
    .milestones.find((m) => m.milestoneCode === "DEST_RECEIVED");
  root.applyProvider(
    {
      milestonePatch: {
        entries: [
          {
            milestoneCode: "DEST_RECEIVED",
            occurredAt: "2026-11-16T08:05:25.000Z",
          },
        ],
      },
    },
    S.DELIVERED,
  );
  const updated = root
    .snapshot()
    .milestones.find((m) => m.milestoneCode === "DEST_RECEIVED");
  assert.equal(updated.id, old.id);
  assert.equal(updated.locationName, "keep");
  assert.equal(root.snapshot().milestones.length, 2);
});
const attrs = (values) => ({ schemaVersion: 1, provider: "uniship", values });
test("typed attributes merge known slots, validate namespace/schema/keys/depth/size, and cannot write canonical/Nexora fields", () => {
  const root = stored({
    providerAttributesPatch: attrs({
      originWarehouseId: "19",
      freightUnitPrice: { amount: "23500", currency: "VND", unit: "kg" },
    }),
  });
  root.applyProvider(
    {
      providerAttributesPatch: attrs({
        lastMileMethod: "CPN-VietelPost",
        originWarehouseId: null,
      }),
    },
    S.DELIVERED,
  );
  const value = root.snapshot().providerAttributes;
  assert.equal(value.values.originWarehouseId, "19");
  assert.equal(value.values.freightUnitPrice.amount, "23500.00");
  assert.equal(value.values.lastMileMethod, "CPN-VietelPost");
  assert.deepEqual(parseShipmentProviderAttributes(value, "uniship"), value);
  for (const patch of [
    { ...attrs({}), schemaVersion: 2 },
    { ...attrs({}), provider: "other" },
    attrs({ ShippingInfo: "private" }),
    attrs({ totalAmount: "0" }),
    attrs({ originWarehouseId: { nested: { nested: "bad" } } }),
    attrs({
      freightUnitPrice: { amount: "1", currency: "VND", unit: "piece" },
    }),
    attrs({
      originWarehouseId: "\u0001".repeat(128),
      lastMileMethod: "\u0001".repeat(128),
    }),
  ])
    assert.throws(() =>
      root.applyProvider({ providerAttributesPatch: patch }, S.DELIVERED),
    );
  assert.equal(
    root.snapshot().providerAttributes.values.lastMileMethod,
    "CPN-VietelPost",
  );
  const copy = root.snapshot();
  copy.providerAttributes.values.originWarehouseId = "mutated";
  assert.equal(
    root.snapshot().providerAttributes.values.originWarehouseId,
    "19",
  );
});
test("legacy hydrated collections above50 can update existing fee targets but cannot append", () => {
  const base = stored().snapshot();
  const root = ShipmentAggregate.hydrate({
    ...base,
    charges: Array.from({ length: 51 }, (_, i) => ({
      id: uuid(100 + i),
      lineNo: i + 1,
      chargeCode: i === 0 ? "INSURANCE" : "OTHER",
      amount: "1.00",
      currency: "VND",
      providerLabel: null,
    })),
  });
  root.applyProvider(
    { chargePatch: { lines: [charge("INSURANCE", "0")] } },
    S.DELIVERED,
  );
  assert.equal(root.snapshot().charges.length, 51);
  assert.equal(root.snapshot().charges[0].amount, "0.00");
  const before = root.snapshot();
  assert.throws(() =>
    root.applyProvider(
      { chargePatch: { lines: [charge("WEIGHT_FREIGHT")] } },
      S.DELIVERED,
    ),
  );
  assert.deepEqual(root.snapshot(), before);
});
