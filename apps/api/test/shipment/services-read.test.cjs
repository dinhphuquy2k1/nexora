require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@nexora/database");
const {
  ShipmentAdapter,
} = require("../../dist/shipment/infrastructure/shipment.adapter");
test("service facts remain tri-state and independent of fees in list and detail; all children share actor transaction", async () => {
  const owner = "00000000-0000-4000-8000-000000000001",
    id = "00000000-0000-4000-8000-000000000002";
  const adapter = new ShipmentAdapter("unused");
  let empty = false,
    foreign = false;
  let calls = [];
  let inside = false;
  const services = [
    { id, shipmentId: id, serviceCode: "FOAM", enabled: true },
    { id: owner, shipmentId: id, serviceCode: "INSURANCE", enabled: false },
  ];
  adapter.instance = {
    $transaction: async (fn) => {
      inside = true;
      try {
        return await fn({
          $queryRaw: async (first, ...values) => {
            assert.equal(inside, true);
            const sql =
              Array.isArray(first) && Object.hasOwn(first, "raw")
                ? Prisma.sql(first, ...values)
                : first;
            const text = sql.sql;
            calls.push(text);
            if (text.includes("FROM users")) {
              assert.match(text, /FOR UPDATE/);
              return [{ status: "ACTIVE" }];
            }
            if (text.includes("GROUP BY s.logistics_stage")) return [];
            if (text.includes("FROM shipments s"))
              return empty || foreign
                ? []
                : [
                    {
                      id,
                      logisticsStage: "UNKNOWN",
                      provider: null,
                      providerAttributes: null,
                    },
                  ];
            if (text.includes("shipment_services"))
              return text.includes("ANY(")
                ? services
                : services.map(({ id, serviceCode, enabled }) => ({
                    id,
                    serviceCode,
                    enabled,
                  }));
            if (text.includes("shipment_charges"))
              return [
                {
                  id,
                  shipmentId: id,
                  lineNo: 1,
                  chargeCode: "COUNTING",
                  amount: "0.00",
                  currency: "CNY",
                  count: 1,
                  providerLabel: null,
                },
              ];
            if (
              text.includes("shipment_milestones") ||
              text.includes("shipment_items")
            )
              return [];
            throw Error("Unexpected SQL " + text);
          },
        });
      } finally {
        inside = false;
      }
    },
  };
  const expected = {
    insurance: false,
    counting: null,
    fragileGoods: null,
    foam: true,
  };
  const list = await adapter.list(owner, { page: 1, pageSize: 20 });
  assert.deepEqual(list.shipments[0].serviceSummary, expected);
  assert.equal(list.shipments[0].chargeSummary.hasCounting, true);
  assert.equal(list.shipments[0].chargeSummary.hasInsurance, false);
  assert.equal(calls.filter((s) => s.includes("ANY(")).length, 4);
  assert.equal(calls.filter((s) => s.includes("shipment_services")).length, 1);
  calls = [];
  const detail = await adapter.get(owner, id);
  assert.deepEqual(detail.serviceSummary, expected);
  assert.deepEqual(detail.services, [
    { id: owner, serviceCode: "INSURANCE", enabled: false },
    { id, serviceCode: "FOAM", enabled: true },
  ]);
  calls = [];
  empty = true;
  await adapter.list(owner, { page: 1, pageSize: 20 });
  assert.equal(
    calls.some((s) => /shipment_(charges|milestones|items|services)/.test(s)),
    false,
  );
  calls = [];
  empty = false;
  foreign = true;
  await assert.rejects(adapter.get(owner, id), (e) => e.code === "NOT_FOUND");
  assert.equal(
    calls.some((s) => s.includes("shipment_services")),
    false,
  );
});
