import { URLSearchParams } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  COLUMNS,
  visibleColumns,
  updateQuery,
  readQuery,
  formatDate,
  formatDecimal,
  stateMessage,
  sourceLabel,
} from "../features/shipments/retail/model.ts";
test("required tracking column survives toggle and empty selection", () => {
  assert.ok(visibleColumns([]).some((c) => c.id === "tracking"));
  assert.equal(new Set(COLUMNS.map((c) => c.id)).size, COLUMNS.length);
});
test("query changes reset page, preserve scope and other filters; pagination clamps", () => {
  const params = new URLSearchParams(
    "provider=uniship&connection=a&q=áo&page=8&custom=x",
  );
  const next = updateQuery(params, { q: "đồ" });
  assert.equal(next.get("page"), null);
  assert.equal(next.get("connection"), "a");
  assert.equal(next.get("custom"), "x");
  assert.equal(readQuery(new URLSearchParams("page=-1&size=999")).page, 1);
  assert.equal(readQuery(new URLSearchParams("page=3&size=20")).size, 20);
  assert.equal(readQuery(new URLSearchParams("page=3&size=20")).page, 3);
});
test("missing and impossible dates do not normalize; decimals retain precision and missing zero distinction", () => {
  for (const date of [null, undefined, "2026-02-30", "not-date"])
    assert.equal(formatDate(date), "—");
  assert.equal(formatDate("2024-02-29"), "29/02/2024");
  assert.equal(formatDecimal(null), "—");
  assert.equal(formatDecimal("0"), "0");
  assert.equal(
    formatDecimal("12345678901234567890.12"),
    "12.345.678.901.234.567.890,12",
  );
});
test("unsupported is never empty/error/loading; source depends on scope", () => {
  assert.notEqual(
    stateMessage("unsupported").title,
    stateMessage("empty").title,
  );
  assert.notEqual(stateMessage("error").title, stateMessage("empty").title);
  assert.notEqual(stateMessage("loading").title, stateMessage("empty").title);
  assert.equal(
    sourceLabel({ type: "all" }, "Uniship", "Tài khoản"),
    "Uniship · Tài khoản",
  );
  assert.equal(
    sourceLabel(
      { type: "provider", provider: "uniship" },
      "Uniship",
      "Tài khoản",
    ),
    "Tài khoản",
  );
  assert.equal(
    sourceLabel(
      { type: "connection", provider: "uniship", id: "a" },
      "Uniship",
      "Tài khoản",
    ),
    "",
  );
});
