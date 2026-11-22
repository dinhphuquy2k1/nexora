import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
const feature = (name) => import(`../features/retail-packages/${name}.ts`);
const summary = () => ({
  id: "00000000-0000-4000-8000-000000000001",
  code: "SHP000001",
  trackingCode: "TEST",
  shipmentKind: "RETAIL_PARCEL",
  provider: "uniship",
  logisticsStage: "UNKNOWN",
  providerStatus: null,
  providerClaimStatus: null,
  customerId: null,
  totalAmount: "1234567890123456.78",
  totalCurrency: "VND",
  createdAt: "2026-11-14T00:00:00Z",
  updatedAt: "2026-11-14T00:00:00Z",
  originWarehouse: null,
  actualPackageCount: null,
  destinationWarehouse: null,
  freightUnitPrice: null,
  weightKg: "1.250",
  packageCount: 0,
  itemCount: null,
  declaredValue: null,
  declaredCurrency: null,
  serviceSummary: {
    insurance: true,
    counting: false,
    fragileGoods: true,
    foam: null,
  },
  chargeSummary: {
    unitPrice: { state: "NONE", amount: null, currency: null },
    domesticShipping: { state: "MULTIPLE", amount: null, currency: null },
    hasInsurance: false,
    hasCounting: true,
    hasWoodPacking: false,
    hasBubbleWrap: true,
  },
  milestoneSummary: {
    originReceivedAt: null,
    originDispatchedAt: null,
    destReceivedAt: "2026-11-13T18:30:00Z",
    destDispatchedAt: null,
    destWarehouse: "Kho nhận",
  },
  itemSummary: { firstName: "Product", lineCount: 3 },
});
test("Retail exact string format preserves decimals and existing currency presentation", async () => {
  const { formatWeight, formatMoney, formatDate } = await feature("format");
  assert.equal(formatWeight("1.250"), "1.25");
  assert.equal(formatWeight("5.800"), "5.80");
  assert.equal(formatWeight("1234.500"), "1234.50");
  assert.equal(formatWeight("1.234"), "1.234");
  assert.equal(formatWeight("0.000"), "0.00");
  assert.equal(formatWeight("0"), "0.00");
  assert.equal(formatWeight("12345678.123"), "12345678.123");
  assert.equal(formatWeight(null), "—");
  assert.equal(formatMoney("38500.00", "VND"), "38.500đ");
  assert.equal(formatMoney("1250.00", "CNY"), "¥1,250.0");
  assert.equal(formatMoney("1.2345", "CNY"), "¥1.2345");
  assert.equal(formatMoney("0", "CNY"), "¥0.0");
  assert.equal(
    formatMoney("1234567890123456.78", "USD"),
    "1,234,567,890,123,456.78 USD",
  );
  assert.equal(formatMoney(null, null), "—");
  assert.equal(formatDate("2026-11-13T18:30:00Z"), "14/11/2026");
  assert.equal(formatDate(null), "—");
});
test("Retail stages and tabs are exhaustive and never send claim or legacy filters", async () => {
  const p = await feature("presentation");
  const pairs = {
    to_origin: "TO_ORIGIN_WAREHOUSE",
    at_origin: "AT_ORIGIN_WAREHOUSE",
    in_transit: "TO_DEST_WAREHOUSE",
    at_dest: "AT_DEST_WAREHOUSE",
    delivered: "DELIVERED",
  };
  for (const [tab, stage] of Object.entries(pairs)) {
    assert.equal(p.tabToStage(tab), stage);
    assert.equal(p.stageToTab(stage), tab);
    assert.equal(typeof p.stageLabel(stage), "string");
  }
  assert.equal(p.stageToTab("UNKNOWN"), null);
  assert.equal(p.stageLabel("UNKNOWN"), "Chưa xác định");
  assert.equal(p.tabToStage("all"), undefined);
  assert.equal(
    p.shipmentListQuery({
      status: "disputed",
      search: "x",
      page: 1,
      pageSize: 10,
      filters: [],
    }),
    null,
  );
  assert.deepEqual(
    p.shipmentListQuery({
      status: "all",
      search: "x",
      page: 2,
      pageSize: 5,
      filters: [{ field: "weightKg", operator: "greater_than", value: "5" }],
    }),
    { q: "x", page: 2, pageSize: 5 },
  );
  assert.equal(p.providerLabel("uniship"), "Uniship");
  assert.equal(p.providerLabel("other"), "other");
  assert.equal(p.providerLabel(null), "—");
});
test("Retail row uses reported summaries without inventing missing account, fees or item values", async () => {
  const { toRetailRow } = await feature("row");
  const x = toRetailRow(summary());
  assert.equal(x.status, null);
  assert.equal(x.statusText, "Chưa xác định");
  assert.equal(x.productName, "Product +2");
  assert.equal(x.carrierLabel, "Uniship");
  assert.equal(x.freightUnitPrice, "—");
  assert.equal(x.domesticShipCNY, "Nhiều dòng");
  assert.equal(x.weightKg, "1.25");
  assert.equal(x.destWarehouseDate, "14/11/2026");
  assert.equal(x.packageCount, "0");
  assert.equal(x.itemCount, "—");
  assert.equal(x.hasInspection, false);
  assert.equal(x.hasBubbleWrap, null);
  assert.equal(Object.hasOwn(x, "accountName"), false);
});
test("Retail response guards reject malformed nested DTOs and unavailable-claim lies", async () => {
  const { readShipmentPage, readShipment, readShipmentHistory } =
    await feature("response");
  const page = () => ({
    shipments: [summary()],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    stats: {
      total: 1,
      byStage: {
        TO_ORIGIN_WAREHOUSE: 0,
        AT_ORIGIN_WAREHOUSE: 0,
        TO_DEST_WAREHOUSE: 0,
        AT_DEST_WAREHOUSE: 0,
        DELIVERED: 0,
        UNKNOWN: 1,
      },
      claims: null,
    },
    claimFilterAvailable: false,
  });
  assert.deepEqual(readShipmentPage(page()), page());
  for (const mutate of [
    (x) => {
      delete x.shipments[0].serviceSummary;
    },
    (x) => {
      x.shipments[0].serviceSummary.insurance = "false";
    },
    (x) => {
      x.claimFilterAvailable = true;
    },
    (x) => {
      x.stats.claims = 0;
    },
    (x) => {
      x.shipments[0].weightKg = 1.25;
    },
    (x) => {
      x.shipments[0].totalAmount = "1e5";
    },
    (x) => {
      x.shipments[0].logisticsStage = "disputed";
    },
    (x) => {
      x.shipments[0].chargeSummary.unitPrice.amount = "1.00";
    },
    (x) => {
      x.shipments[0].itemSummary.lineCount = -1;
    },
    (x) => {
      delete x.shipments[0].createdAt;
    },
    (x) => {
      x.pagination.pageSize = 101;
    },
  ]) {
    const x = page();
    mutate(x);
    assert.throws(() => readShipmentPage(x), /MALFORMED_RESPONSE/);
  }
  const detail = {
    ...summary(),
    serviceLevel: null,
    providerPaidAmount: null,
    providerRemainingAmount: null,
    providerPaidAt: null,
    originWarehouseProviderId: null,
    providerCreatedAt: null,
    lastMileMethod: null,
    exchangeRate: null,
    exchangeRateAt: null,
    providerUpdatedAt: null,
    lastSyncedAt: null,
    assigneeUserId: null,
    internalNote: null,
    serviceSummary: {
      insurance: null,
      counting: null,
      fragileGoods: null,
      foam: null,
    },
    services: [],
    charges: [],
    milestones: [],
    items: [
      {
        id: "item",
        lineNo: 1,
        name: "product",
        quantity: null,
        unitValue: "1234567890123456.78",
        currency: "CNY",
      },
    ],
  };
  assert.deepEqual(readShipment({ shipment: detail }), detail);
  assert.throws(
    () =>
      readShipment({
        shipment: { ...detail, items: [{ ...detail.items[0], unitValue: 1 }] },
      }),
    /MALFORMED_RESPONSE/,
  );
  for (const services of [
    null,
    [{ id: "service", serviceCode: "WOOD_PACKING", enabled: true }],
    [{ id: "service", serviceCode: "FOAM", enabled: null }],
    [
      { id: "service", serviceCode: "FOAM", enabled: false },
      { id: "another", serviceCode: "FOAM", enabled: true },
    ],
  ]) {
    assert.throws(
      () => readShipment({ shipment: { ...detail, services } }),
      /MALFORMED_RESPONSE/,
    );
  }
  const history = {
    history: [
      {
        id: "history",
        sourceVersion: 1,
        processorVersion: 2,
        fromStage: null,
        toStage: "UNKNOWN",
        providerStatus: null,
        providerChangedAt: null,
        observedAt: "2026-11-14T00:00:00Z",
      },
    ],
    pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
  };
  assert.deepEqual(readShipmentHistory(history), history);
  assert.throws(
    () =>
      readShipmentHistory({
        ...history,
        history: [{ ...history.history[0], toStage: "BAD" }],
      }),
    /MALFORMED_RESPONSE/,
  );
});

test("Retail maps confirmed packing services without inferring truth from charges", async () => {
  const { toRetailRow } = await feature("row");
  for (const fragileGoods of [true, false, null]) {
    for (const foam of [true, false, null]) {
      const s = summary();
      s.serviceSummary = {
        insurance: null,
        counting: null,
        fragileGoods,
        foam,
      };
      s.chargeSummary.hasWoodPacking = fragileGoods !== true;
      s.chargeSummary.hasBubbleWrap = foam !== true;
      const row = toRetailRow(s);
      assert.equal(row.hasInsurance, null);
      assert.equal(row.hasInspection, null);
      assert.equal(row.hasWoodenCrate, fragileGoods);
      assert.equal(row.hasBubbleWrap, foam);
    }
  }
});

test("Retail typed freight price uses actual VND/kg, preserves legacy currency and independent counts/destination", async () => {
  const { toRetailRow } = await feature("row");
  const s = summary();
  s.freightUnitPrice = { amount: "23500.00", currency: "VND", unit: "kg" };
  s.actualPackageCount = 1;
  s.destinationWarehouse = "Kho Hà Nội";
  const row = toRetailRow(s);
  assert.equal(row.freightUnitPrice, "23.500đ/kg");
  assert.equal(row.actualPackageCount, "1");
  assert.equal(row.packageCount, "0");
  assert.equal(row.destWarehouseName, "Kho Hà Nội");
  s.freightUnitPrice = null;
  s.chargeSummary.unitPrice = {
    state: "SINGLE",
    amount: "12.00",
    currency: "CNY",
  };
  assert.equal(toRetailRow(s).freightUnitPrice, "¥12.0");
  s.freightUnitPrice = { amount: "0.00", currency: "VND", unit: "kg" };
  assert.equal(toRetailRow(s).freightUnitPrice, "0đ/kg");
});

test("Shipment milestones render in Asia/Ho_Chi_Minh with time and day rollover regardless of host zone", async () => {
  const { formatDate } = await feature("format");
  const { toRetailRow } = await feature("row");
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/New_York", "Asia/Tokyo"]) {
      process.env.TZ = zone;
      assert.equal(
        formatDate("2026-11-20T03:03:16.000Z", true),
        "20/11/2026 10:03",
      );
      assert.equal(
        formatDate("2026-11-19T20:03:16.000Z", true),
        "20/11/2026 03:03",
      );
      assert.equal(
        formatDate("2026-11-19T18:30:00.000Z", true),
        "20/11/2026 01:30",
      );
      const s = summary();
      s.milestoneSummary.destReceivedAt = "2026-11-19T18:30:00.000Z";
      assert.equal(toRetailRow(s).destWarehouseDate, "20/11/2026");
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("Retail shared decimal predicate preserves lexical-only acceptance and kilogram wire enum", async () => {
  const { readShipmentPage } = await feature("response");
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "../../../packages/shared/test/fixtures/numeric-parity.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const page = () => ({
    shipments: [summary()],
    pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    stats: {
      total: 1,
      byStage: {
        TO_ORIGIN_WAREHOUSE: 0,
        AT_ORIGIN_WAREHOUSE: 0,
        TO_DEST_WAREHOUSE: 0,
        AT_DEST_WAREHOUSE: 0,
        DELIVERED: 0,
        UNKNOWN: 1,
      },
      claims: null,
    },
    claimFilterAvailable: false,
  });
  for (const row of fixture.cases) {
    const p = page();
    p.shipments[0].weightKg = row.source;
    if (row.lexical) assert.deepEqual(readShipmentPage(p), p);
    else assert.throws(() => readShipmentPage(p));
  }
  for (const unit of ["kg", "g", "lb", "KG", null, undefined]) {
    const p = page();
    p.shipments[0].freightUnitPrice = { amount: "1.00", currency: "VND", unit };
    if (unit === "kg") assert.deepEqual(readShipmentPage(p), p);
    else assert.throws(() => readShipmentPage(p));
  }
  // Response DTO guard intentionally accepts object prototypes; provider envelope policy differs.
  const p = page();
  Object.setPrototypeOf(p.shipments[0], { marker: true });
  assert.equal(readShipmentPage(p), p);
});
