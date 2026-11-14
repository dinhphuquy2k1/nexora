require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ShipmentService,
} = require("../../dist/shipment/application/shipment.service");
test("Shipment read service rejects invalid queries/UUID before port; claims are explicitly unavailable", async () => {
  const calls = [];
  const service = new ShipmentService({
    list: async (owner, q) => {
      calls.push([owner, q]);
      return {};
    },
    get: async () => ({}),
  });
  for (const query of [
    { page: "0" },
    { pageSize: "101" },
    { stage: "BAD" },
    { q: ["x"] },
    { extra: "field" },
  ])
    await assert.rejects(
      service.list({ id: "owner" }, query),
      (e) => e.getStatus() === 400,
    );
  await assert.rejects(
    service.get({ id: "owner" }, "bad"),
    (e) => e.getStatus() === 400,
  );
  await assert.rejects(
    service.list({ id: "owner" }, { claim: "open" }),
    (e) =>
      e.getStatus() === 422 &&
      e.getResponse().code === "CLAIM_FILTER_UNAVAILABLE",
  );
  assert.equal(calls.length, 0);
  await service.list({ id: "owner" }, {});
  assert.equal(calls[0][0], "owner");
  assert.equal(calls[0][1].pageSize, 20);
});

test("Nest application shutdown disconnects Shipment read pool and keeps unused adapters lazy", async () => {
  const { Module } = require("@nestjs/common");
  const { NestFactory } = require("@nestjs/core");
  const {
    ShipmentAdapter,
  } = require("../../dist/shipment/infrastructure/shipment.adapter");
  let disconnected = 0;
  const active = new ShipmentAdapter("unused"),
    unused = new ShipmentAdapter("unused");
  active.instance = {
    $disconnect: async () => {
      disconnected++;
    },
  };
  class FixtureModule {}
  Module({
    providers: [
      { provide: "active", useValue: active },
      { provide: "unused", useValue: unused },
    ],
  })(FixtureModule);
  const context = await NestFactory.createApplicationContext(FixtureModule, {
    logger: false,
  });
  await context.close();
  assert.equal(disconnected, 1);
  assert.equal(unused.instance, undefined);
});

test("Shipment list batches all child summaries within its locked transaction", async () => {
  const {
    ShipmentAdapter,
  } = require("../../dist/shipment/infrastructure/shipment.adapter");
  const adapter = new ShipmentAdapter("unused");
  const calls = [];
  const root = {
    id: "00000000-0000-4000-8000-000000000001",
    logisticsStage: "UNKNOWN",
  };
  const { Prisma } = require("@nexora/database");
  adapter.instance = {
    $transaction: async (fn) =>
      fn({
        $queryRaw: async (first, ...values) => {
          const sql =
            Array.isArray(first) && Object.hasOwn(first, "raw")
              ? Prisma.sql(first, ...values)
              : first;
          const text = sql.sql;
          calls.push(text);
          if (text.includes("FROM users")) return [{ status: "ACTIVE" }];
          if (text.includes("GROUP BY s.logistics_stage"))
            return [{ stage: "UNKNOWN", count: 1 }];
          if (text.includes("FROM shipments s")) return [root];
          if (text.includes("shipment_charges"))
            return [
              {
                shipmentId: root.id,
                chargeCode: "UNIT_PRICE",
                count: 1,
                amount: "1234567890123456.78",
                currency: "CNY",
              },
            ];
          if (text.includes("shipment_milestones"))
            return [
              {
                shipmentId: root.id,
                milestoneCode: "DEST_RECEIVED",
                occurredAt: new Date("2026-11-14T00:00:00Z"),
                locationName: "Warehouse",
              },
            ];
          if (text.includes("shipment_items"))
            return [
              { shipmentId: root.id, firstName: "Product", lineCount: 2 },
            ];
          throw Error("Unexpected fixture SQL");
        },
      }),
  };
  const result = await adapter.list("00000000-0000-4000-8000-000000000002", {
    page: 1,
    pageSize: 20,
  });
  assert.equal(calls.length, 6);
  assert.equal(calls.filter((sql) => sql.includes("ANY(")).length, 3);
  assert.equal(
    result.shipments[0].chargeSummary.unitPrice.amount,
    "1234567890123456.78",
  );
  assert.equal(result.shipments[0].milestoneSummary.destWarehouse, "Warehouse");
  assert.deepEqual(result.shipments[0].itemSummary, {
    firstName: "Product",
    lineCount: 2,
  });
});
