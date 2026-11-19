const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  captured,
  stores,
  row,
  page,
} = require("../helpers/uniship-fixture.cjs");
const {
  parseUnishipPage,
  parseUnishipWarehouses,
} = require("../../dist/shipment/infrastructure/uniship/uniship-normalizer");
const {
  UnishipShipmentProcessor,
} = require("../../dist/shipment/infrastructure/uniship/uniship-shipment.processor");
const { LogisticsStage: S } = require("@nexora/shared/shipment");
const warehouses = () => parseUnishipWarehouses(stores);
const parse = (text, number = 1, size = 100, warnings = []) =>
  parseUnishipPage(text, number, size, warehouses(), (c) => warnings.push(c));

test("captured bytes and15-row provenance are preserved; minimal normalized fields exclude private and unverified facts", () => {
  assert.equal(
    createHash("sha256").update(captured).digest("hex"),
    "b328f42ea39a2870623a7a1c28bc29b98ca6ae90f4690d9f06ba1cd6f4473a2c",
  );
  assert.equal(
    createHash("sha256").update(stores).digest("hex"),
    "8fd8c076a0598b8c195eefcea8747cc463b10ec5fce0731043b1350ee59cccdf",
  );
  const result = parse(captured, 1, 15);
  assert.equal(result.done, true);
  assert.deepEqual(JSON.parse(result.records[0].identity.key), ["330294"]);
  const value = result.records[0].payload;
  assert.equal(value.shipment.trackingCode, "md00001");
  assert.equal(value.shipment.weightKg, "0.000");
  assert.equal(value.shipment.originWarehouse, warehouses().get("19"));
  assert.equal(value.shipment.providerStatus, "1");
  assert.equal(value.shipment.providerClaimStatus, null);
  assert.deepEqual(
    Object.keys(value.shipment).sort(),
    [
      "originWarehouse",
      "providerClaimStatus",
      "providerStatus",
      "trackingCode",
      "weightKg",
    ].sort(),
  );
  for (const privateValue of ["redacted-user", "Kho Hà Nội"])
    assert.equal(JSON.stringify(value).includes(privateValue), false);
  assert.notEqual(
    warehouses().get("1"),
    "Kho Hà Nội",
    "ReceivePlaceID is not ChinaStoreID",
  );
});

test("source numeric lexemes preserve huge IDs and exact decimals; malformed valid-ID rows reject without payload leakage", () => {
  const text = page([row({ ID: 7, Weight: 1 })])
    .replace('"ID":7', '"ID":9007199254740993123')
    .replace('"Weight":1', '"Weight":1234567.891');
  const r = parse(text).records[0];
  assert.deepEqual(JSON.parse(r.identity.key), ["9007199254740993123"]);
  assert.equal(r.payload.shipment.weightKg, "1234567.891");
  for (const change of [
    { Weight: -1 },
    { Weight: "1" },
    { Weight: 1.2345 },
    { TransactionCode: null },
    { Status: "1" },
  ]) {
    const warnings = [];
    const bad = parse(
      page([row({ ...change, Username: "private-injected-marker" })]),
      1,
      100,
      warnings,
    );
    assert.deepEqual(bad.records[0].payload, { invalid: true });
    assert.ok(
      warnings.some((c) =>
        [
          "UNISHIP_FIELD_TYPE_CHANGED",
          "UNISHIP_REQUIRED_FIELD_MISSING",
        ].includes(c),
      ),
    );
    assert.equal(
      JSON.stringify([bad, warnings]).includes("private-injected-marker"),
      false,
    );
  }
  for (const ID of [null, 0, -1, 1.5, "001", "123"])
    assert.throws(
      () => parse(page([row({ ID })])),
      (e) => e.code === "SOURCE_INVALID",
    );
});

test("FULL pagination validates offset/total/size/summary and rejects duplicate IDs before checkpoint", () => {
  const rows = Array.from({ length: 100 }, (_, i) => row({ ID: i + 1 }));
  assert.deepEqual(
    [
      parse(page(rows, { total: 101 })).done,
      parse(page(rows, { total: 101 })).nextPage,
    ],
    [false, 2],
  );
  assert.equal(parse(page([row()], { total: 101, offset: 100 }), 2).done, true);
  assert.equal(parse(page([])).done, true);
  for (const text of [
    "{}",
    "not-json",
    page([row(), row()]),
    page([row()], { total: 2 }),
    page([row()], { offset: 1 }),
    page([row()], { size: 15 }),
    page([row()]).replace('"summary":{', '"summary":null,"ignored":{'),
  ])
    assert.throws(
      () => parse(text),
      (e) => e.code === "SOURCE_INVALID",
    );
  for (const number of [0, -1, 1.5, Number.MAX_SAFE_INTEGER])
    assert.throws(
      () => parse(page([row()]), number),
      (e) => e.code === "SOURCE_INVALID",
    );
});

test("unverified service flags, fees, items, timestamps and missing warehouse facts never fabricate authoritative collections", () => {
  for (const flags of [null, false, true, 0, 1, undefined]) {
    const warnings = [];
    const r = parse(
      page([
        row({
          IsGuarantee: flags,
          IsCheck: flags,
          IsFragileGoods: flags,
          IsFoam: flags,
          ProductName: "a product",
          GuaranteeAmount: 99,
          ChinaStoreID: 999999,
          Weight: null,
        }),
      ]),
      1,
      100,
      warnings,
    ).records[0];
    for (const key of [
      "services",
      "charges",
      "items",
      "milestones",
      "originWarehouse",
      "weightKg",
      "providerUpdatedAt",
      "declaredValue",
      "totalAmount",
    ])
      assert.equal(Object.hasOwn(r.payload.shipment, key), false, key);
    assert.ok(warnings.includes("UNISHIP_REQUIRED_FIELD_MISSING"));
  }
  const altered = JSON.parse(stores);
  altered.data.push({ ...altered.data[0] });
  altered.total = altered.data.length;
  assert.throws(
    () => parseUnishipWarehouses(JSON.stringify(altered)),
    (e) => e.code === "SOURCE_INVALID",
  );
});

test("synthetic status and claim policy uses validated OldStatus first, then trusted previous stage; DB faults propagate", async () => {
  const warnings = [];
  const processor = new UnishipShipmentProcessor(1, (c) => warnings.push(c));
  const physical = [
    S.TO_ORIGIN_WAREHOUSE,
    S.AT_ORIGIN_WAREHOUSE,
    S.TO_DEST_WAREHOUSE,
    S.AT_DEST_WAREHOUSE,
    S.DELIVERED,
  ];
  const cases = physical.map((s, i) => [i + 1, null, null, s]);
  cases.push(
    [13, 4, S.DELIVERED, S.AT_DEST_WAREHOUSE],
    [13, null, S.DELIVERED, S.DELIVERED],
    [13, 99, S.AT_ORIGIN_WAREHOUSE, S.AT_ORIGIN_WAREHOUSE],
    [13, null, null, S.UNKNOWN],
    [0, null, S.DELIVERED, S.UNKNOWN],
    [99, null, null, S.UNKNOWN],
  );
  for (const [Status, OldStatus, previous, expected] of cases) {
    let observed;
    const record = parse(page([row({ Status, OldStatus })])).records[0];
    const decision = await processor.apply(
      { payload: record.payload },
      {
        existingProviderStatus: null,
        existingLogisticsStage: previous,
        propose: async (input, stage) => {
          observed = { input, stage };
        },
      },
    );
    assert.equal(decision.outcome, "APPLIED");
    assert.equal(observed.stage, expected);
    assert.equal(
      observed.input.providerClaimStatus,
      Status === 13 ? "13" : null,
    );
  }
  assert.deepEqual(warnings, [
    "UNISHIP_STATUS_UNKNOWN",
    "UNISHIP_STATUS_UNKNOWN",
  ]);
  assert.deepEqual(await processor.apply({ payload: { invalid: true } }, {}), {
    outcome: "REJECTED_SOURCE",
    code: "SOURCE_INVALID",
  });
  await assert.rejects(
    processor.apply(
      { payload: parse(captured, 1, 15).records[0].payload },
      {
        existingProviderStatus: null,
        existingLogisticsStage: null,
        propose: async () => {
          throw Error("synthetic SQL failure");
        },
      },
    ),
    /synthetic SQL failure/,
  );
});
