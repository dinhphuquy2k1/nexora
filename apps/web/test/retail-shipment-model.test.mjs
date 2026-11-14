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
  weightKg: "1.25",
  packageCount: 0,
  itemCount: null,
  declaredValue: null,
  declaredCurrency: null,
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
  const { formatDecimal, formatMoney, formatDate } = await feature("format");
  assert.equal(
    formatDecimal("1234567890123456.7800"),
    "1.234.567.890.123.456.7800",
  );
  assert.equal(formatDecimal("5.80"), "5.80");
  assert.equal(formatDecimal("0"), "0");
  assert.equal(formatDecimal(null), "—");
  assert.equal(formatMoney("38500.00", "VND"), "38.500đ");
  assert.equal(formatMoney("1250.00", "CNY"), "¥1,250.0");
  assert.equal(formatMoney("1.2345", "CNY"), "¥1.2345");
  assert.equal(formatMoney("0", "CNY"), "¥0.0");
  assert.equal(
    formatMoney("1234567890123456.78", "USD"),
    "1.234.567.890.123.456.78 USD",
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
  assert.equal(x.unitPriceCNY, "—");
  assert.equal(x.domesticShipCNY, "Nhiều dòng");
  assert.equal(x.weightKg, "1.25");
  assert.equal(x.destWarehouseDate, "14/11/2026");
  assert.equal(x.packageCount, "0");
  assert.equal(x.itemCount, "—");
  assert.equal(x.hasInspection, true);
  assert.equal(x.hasBubbleWrap, true);
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
    exchangeRate: null,
    exchangeRateAt: null,
    providerUpdatedAt: null,
    lastSyncedAt: null,
    assigneeUserId: null,
    internalNote: null,
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
