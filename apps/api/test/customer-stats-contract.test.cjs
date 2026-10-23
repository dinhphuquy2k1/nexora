const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const schema = JSON.parse(
  readFileSync(resolve(__dirname, "../openapi/openapi.json"), "utf8"),
);

test("Customer list OpenAPI requires nonnegative integer stats without changing eight operations", () => {
  const models = schema.components.schemas;
  assert.ok(models.CustomersResponseDto.required.includes("stats"));
  assert.deepEqual(models.CustomersResponseDto.properties.stats, {
    $ref: "#/components/schemas/CustomerStatsDto",
  });
  const stats = models.CustomerStatsDto;
  assert.deepEqual([...stats.required].sort(), ["active", "inactive", "total"]);
  for (const field of ["total", "active", "inactive"])
    assert.deepEqual(stats.properties[field], { type: "integer", minimum: 0 });
  const methods = ["get", "post", "patch", "put", "delete"];
  const count = Object.entries(schema.paths)
    .filter(([path]) => path.startsWith("/api/customers"))
    .reduce(
      (n, [, path]) => n + methods.filter((method) => path[method]).length,
      0,
    );
  assert.equal(count, 8);
  assert.equal(models.CustomerSummaryDto.properties.stats, undefined);
  assert.equal(models.CustomerDetailDto.properties.stats, undefined);
  const sdk = readFileSync(
    resolve(__dirname, "../../../packages/sdk/src/generated/api.ts"),
    "utf8",
  );
  assert.match(sdk, /stats: components\["schemas"\]\["CustomerStatsDto"\]/);
});

test("actual SDK decoder tolerates additive stats and leaves old-server stats unavailable", async () => {
  // Native Node24 type stripping loads the actual unchanged SDK entry point.
  const { createNexoraClient } = await import(
    "../../../packages/sdk/src/index.ts"
  );
  const { createServer } = require("node:http");
  const old = {
    customers: [],
    pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
  };
  const current = { ...old, stats: { total: 0, active: 0, inactive: 0 } };
  let response = old;
  const server = createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(response));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const client = createNexoraClient(
      `http://127.0.0.1:${server.address().port}`,
    );
    for (const payload of [old, current]) {
      response = payload;
      // Existing SDK transport has no runtime field stripping/schema decoding.
      const { data, error } = await client.GET("/api/customers");
      assert.equal(error, undefined);
      const { customers, pagination } = data; // legacy consumer projection
      assert.deepEqual({ customers, pagination }, old);
      assert.deepEqual(data.stats, payload.stats);
      assert.equal(Object.hasOwn(data, "stats"), payload === current);
    }
  } finally {
    await new Promise((r) => server.close(r));
  }
});
