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
      e.getStatus() === 503 &&
      e.getResponse().code === "CLAIM_FILTER_UNAVAILABLE",
  );
  assert.equal(calls.length, 0);
  await service.list({ id: "owner" }, {});
  assert.equal(calls[0][0], "owner");
  assert.equal(calls[0][1].pageSize, 20);
});
