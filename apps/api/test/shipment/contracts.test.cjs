const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const api = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../openapi/openapi.json"),
    "utf8",
  ),
);
test("Shipment OpenAPI describes integer pagination, null-only unavailable claims and decimal strings", () => {
  const schemas = api.components.schemas;
  for (const name of ["ShipmentQueryDto", "ShipmentHistoryQueryDto"]) {
    // Query DTOs are emitted as route parameters rather than component schemas.
    const route =
      name === "ShipmentQueryDto"
        ? "/api/shipments"
        : "/api/shipments/{id}/history";
    const params = api.paths[route].get.parameters;
    for (const key of ["page", "pageSize"]) {
      const p = params.find((p) => p.name === key).schema;
      assert.equal(p.type, "integer");
      assert.equal(p.minimum, 1);
      assert.equal(p.default, key === "page" ? 1 : 20);
      if (key === "pageSize") assert.equal(p.maximum, 100);
    }
  }
  assert.equal(schemas.ShipmentStatsDto.properties.claims.type, "integer");
  assert.equal(schemas.ShipmentStatsDto.properties.claims.nullable, true);
  assert.deepEqual(schemas.ShipmentStatsDto.properties.claims.enum, [null]);
  assert.equal(schemas.ShipmentChargeDto.properties.amount.type, "string");
  assert.equal(schemas.ShipmentChargeDto.properties.lineNo.type, "integer");
  assert.equal(
    schemas.ShipmentHistoryDto.properties.processorVersion.type,
    "integer",
  );
  const sdk = fs.readFileSync(
    path.resolve(__dirname, "../../../../packages/sdk/src/generated/api.ts"),
    "utf8",
  );
  assert.match(sdk, /\/api\/shipments/);
});
