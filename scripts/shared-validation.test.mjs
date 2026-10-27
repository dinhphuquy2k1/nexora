import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PaginationLimits,
  parsePagination,
  parsePositiveInteger,
  normalizeBoundedText,
  normalizeRawBoundedText,
} from "../packages/shared/dist/index.js";

test("shared pagination defaults to 20 and rejects noncanonical input", () => {
  assert.deepEqual(parsePagination(undefined, undefined), {
    page: 1,
    pageSize: 20,
  });
  assert.equal(PaginationLimits.DEFAULT_PAGE_SIZE, 20);
  assert.deepEqual(parsePagination("2", "100"), { page: 2, pageSize: 100 });
  for (const invalid of [
    "0",
    "-1",
    "01",
    "1.2",
    " 1",
    "1 ",
    "Infinity",
    "9007199254740992",
    "",
    1,
    ["1"],
  ]) {
    assert.equal(
      parsePositiveInteger(invalid, 1, PaginationLimits.MAX_PAGE),
      null,
    );
    assert.equal(parsePagination(invalid, undefined), null);
  }
  assert.equal(parsePagination("2147483647", "20"), null);
  assert.deepEqual(parsePagination("2147483647", "1"), {
    page: 2147483647,
    pageSize: 1,
  });
  assert.equal(parsePagination(undefined, "101"), null);
  assert.equal(parsePagination("2", "100", { maxOffset: 50 }), null);
});

test("shared text preserves trimmed bounds and raw phone input limits", () => {
  assert.equal(normalizeBoundedText("  Alice  ", 10), "Alice");
  assert.equal(normalizeBoundedText("  ", 10), null);
  assert.equal(normalizeBoundedText("  ", 10, false), "");
  assert.equal(normalizeRawBoundedText(" 123 ", 5), "123");
  assert.equal(normalizeRawBoundedText(" 123 ", 4), null);
  assert.equal(normalizeRawBoundedText("invalid-phone", 64), "invalid-phone");
  assert.equal(normalizeBoundedText(123, 10), null);
});
