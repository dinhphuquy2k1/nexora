import test from "node:test";
import { URLSearchParams } from "node:url";
import assert from "node:assert/strict";
import {
  FILTER_FIELDS,
  makeFilter,
  addFilter,
  matchesFilter,
  filterPackages,
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
import { SYNTHETIC_PACKAGES } from "./fixtures/retail-packages.ts";
test("nine typed fields, strict calendar/number/text policies and no silent invalid match", () => {
  assert.equal(FILTER_FIELDS.length, 9);
  assert.equal(calendarDay("31/02/2026"), null);
  assert.equal(calendarDay("2026-02-29"), null);
  assert.equal(calendarDay("29/02/2024"), calendarDay("2024-02-29"));
  assert.equal(calendarDay("2026-02-28x"), null);
  const base = {
    ...SYNTHETIC_PACKAGES[0],
    weightKg: 7,
    unitPriceCNY: 85,
    trackingCode: "AbC123",
    productName: "Áo khoác",
    originWarehouseName: "Kho TMĐT Quảng Châu",
    originWarehouseDate: "15/02/2026",
  };
  for (const [field, operator, value, expected] of [
    ["weightKg", "greater_than", "5", true],
    ["weightKg", "less_than", "5", false],
    ["weightKg", "equals", "7", true],
    ["unitPriceCNY", "equals", "85", true],
    ["trackingCode", "contains", "bc1", true],
    ["trackingCode", "not_contains", "bc1", false],
    ["productName", "not_equals", "khác", true],
    ["originWarehouse", "equals", "Quảng Châu", true],
    ["originWarehouse", "not_equals", "Quảng Châu", false],
    ["originWarehouseDate", "before", "2026-02-16", true],
    ["originWarehouseDate", "after", "2026-02-14", true],
    ["originWarehouseDate", "equals", "2026-02-15", true],
  ])
    assert.equal(
      matchesFilter(base, makeFilter(field, operator, value)),
      expected,
      [field, operator, value].join("/"),
    );
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
  assert.equal(
    matchesFilter(base, { field: "wat", operator: "equals", value: "1" }),
    false,
  );
  const a = makeFilter("trackingCode", "contains", "ABC");
  const b = makeFilter("trackingCode", "contains", "abc");
  assert.equal(addFilter([a], b).length, 1);
  assert.deepEqual(
    filterPackages([base], {
      status: "all",
      search: "abc",
      filters: [
        makeFilter("weightKg", "greater_than", "5"),
        makeFilter("originWarehouseDate", "before", "2026-03-01"),
      ],
    }),
    [base],
  );
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
