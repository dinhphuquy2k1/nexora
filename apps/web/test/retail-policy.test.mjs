import test from "node:test";
import { URLSearchParams } from "node:url";
import assert from "node:assert/strict";
import {
  FILTER_FIELDS,
  makeFilter,
  addFilter,
  calendarDay,
} from "../features/retail-packages/filters.ts";
import {
  parseRetailQuery,
  retailQueryString,
  tryRetailQueryString,
} from "../features/retail-packages/query.ts";
import {
  columnPreset,
  visibleColumns,
  searchColumns,
} from "../features/retail-packages/columns.ts";
import { shipmentListQuery } from "../features/retail-packages/presentation.ts";
test("nine typed legacy fields validate strictly without applying client filtering", () => {
  assert.equal(FILTER_FIELDS.length, 9);
  assert.equal(calendarDay("31/02/2026"), null);
  assert.equal(calendarDay("2026-02-29"), null);
  assert.equal(calendarDay("29/02/2024"), calendarDay("2024-02-29"));
  assert.equal(calendarDay("2026-02-28x"), null);
  for (const [field, operator, value] of [
    ["weightKg", "greater_than", "5"],
    ["unitPriceCNY", "equals", "85"],
    ["trackingCode", "contains", "bc1"],
    ["originWarehouse", "equals", "Quảng Châu"],
    ["originWarehouseDate", "before", "2026-02-16"],
  ])
    assert.ok(makeFilter(field, operator, value));
  for (const [f, o, v] of [
    ["wat", "equals", "1"],
    ["weightKg", "contains", "5"],
    ["weightKg", "equals", "5kg"],
    ["weightKg", "equals", "Infinity"],
    ["originWarehouseDate", "before", "2026-02-31"],
    ["trackingCode", "contains", " "],
    ["status", "equals", "bogus"],
  ])
    assert.equal(makeFilter(f, o, v), null);
  const a = makeFilter("trackingCode", "contains", "ABC");
  const b = makeFilter("trackingCode", "contains", "abc");
  assert.equal(addFilter([a], b).length, 1);
  const legacy = {
    status: "all",
    search: "abc",
    page: 1,
    pageSize: 10,
    filters: [makeFilter("weightKg", "greater_than", "5")],
  };
  assert.deepEqual(shipmentListQuery(legacy), {
    q: "abc",
    page: 1,
    pageSize: 10,
  });
  for (const field of FILTER_FIELDS)
    for (const op of field.operators) {
      const value =
        field.defaultValue ||
        { text: "abc", number: "5", date: "2026-01-01" }[field.type];
      assert.ok(makeFilter(field.id, op.value, value));
    }
});
test("query round-trip, bounded invalid inputs, duplicates and unknowns fail closed", () => {
  const q = {
    status: "at_origin",
    search: "áo & abc",
    page: 2,
    pageSize: 5,
    filters: [makeFilter("weightKg", "greater_than", "5")],
  };
  const url = retailQueryString(q);
  assert.deepEqual(parseRetailQuery(new URLSearchParams(url)), q);
  assert.equal(parseRetailQuery(new URLSearchParams()).pageSize, 10);
  for (const raw of [
    "page=0",
    "page=1&page=2",
    "status=bogus",
    "pageSize=3",
    "unknown=1",
    "page=999999999999999",
    "filters=notjson",
    "filters=" +
      encodeURIComponent('[{"field":"bad","operator":"equals","value":"1"}]'),
    "search=" + "a".repeat(201),
  ])
    assert.throws(() => parseRetailQuery(new URLSearchParams(raw)), raw);
  const history = [
    url,
    retailQueryString({ ...q, status: "all", page: 1 }),
    url,
  ];
  assert.deepEqual(
    history.map((s) => parseRetailQuery(new URLSearchParams(s)))[2],
    q,
  );
});
test("column presets have one registry, required tracking survives every visibility choice", () => {
  assert.equal(visibleColumns(columnPreset("all")).length, 20);
  assert.equal(visibleColumns(columnPreset("default")).length, 19);
  assert.equal(visibleColumns(columnPreset("basic")).length, 7);
  assert.ok(
    visibleColumns({ trackingCode: false }).some(
      (c) => c.id === "trackingCode",
    ),
  );
  assert.equal(searchColumns("VẬN ĐƠN")[0].id, "trackingCode");
});

test("composite Unicode query budget is safely rejected at UI boundary", () => {
  const filters = Array.from({ length: 4 }, (_, i) =>
    makeFilter("trackingCode", "contains", String(i) + "á".repeat(198)),
  );
  assert.ok(filters.every(Boolean));
  assert.equal(
    tryRetailQueryString({
      status: "all",
      search: "",
      page: 1,
      pageSize: 10,
      filters,
    }),
    null,
  );
});
