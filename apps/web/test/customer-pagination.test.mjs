import test from "node:test";
import assert from "node:assert/strict";
import {
  customerPageWindow,
  derivePaginationModel,
} from "../features/customers/pagination.ts";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const { CustomerPagination } = loadComponent(
  new URL("../features/customers/CustomerPagination.tsx", import.meta.url)
    .pathname,
);

test("pagination window stays bounded at huge populations and empty/edge pages", () => {
  for (const total of [0, 1, 2, 10, 2147483647])
    for (const p of [1, 2, 5, 1000000000]) {
      const w = customerPageWindow(p, total);
      assert.ok(w.length <= 5);
      assert.equal(w[0], 1);
      assert.equal(w.at(-1), Math.max(1, total));
      assert.ok(
        w.every(
          (n) => Number.isInteger(n) && n >= 1 && n <= Math.max(1, total),
        ),
      );
    }
  assert.deepEqual(customerPageWindow(5, 10), [1, 4, 5, 6, 10]);
});

test("derivePaginationModel: authoritative response computes exact range, totals and navigation", () => {
  const model = derivePaginationModel({
    query: { page: 2, pageSize: 10 },
    pagination: { page: 2, pageSize: 10, total: 25, totalPages: 3 },
    stats: { total: 25, active: 20, inactive: 5 },
    rowCount: 10,
    loading: false,
  });

  assert.equal(model.isAuthoritative, true);
  assert.equal(model.isEstimated, false);
  assert.equal(model.page, 2);
  assert.equal(model.pageSize, 10);
  assert.equal(model.total, 25);
  assert.equal(model.totalPages, 3);
  assert.deepEqual(model.pages, [1, 2, 3]);
  assert.equal(model.from, 11);
  assert.equal(model.to, 20);
  assert.equal(model.summaryRange, "11–20");
  assert.equal(model.summaryTotal, "25");
  assert.equal(model.canPrev, true);
  assert.equal(model.canNext, true);
  assert.equal(model.canFirst, true);
  assert.equal(model.canLast, true);
});

test("derivePaginationModel: tab with zero results", () => {
  const model = derivePaginationModel({
    query: { page: 1, pageSize: 10, status: "INACTIVE" },
    pagination: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    stats: { total: 10, active: 10, inactive: 0 },
    rowCount: 0,
    loading: false,
  });

  assert.equal(model.total, 0);
  assert.equal(model.totalPages, 1);
  assert.deepEqual(model.pages, [1]);
  assert.equal(model.summaryRange, "0");
  assert.equal(model.summaryTotal, "0");
  assert.equal(model.canPrev, false);
  assert.equal(model.canNext, false);
});

test("derivePaginationModel: transition reuses valid same-scope statistics during loading without flicker", () => {
  // User navigates from ALL to ACTIVE tab.
  // Before network response settles, pagination is undefined, but valid stats snapshot exists.
  const loadingModel = derivePaginationModel({
    query: { page: 1, pageSize: 10, status: "ACTIVE" },
    pagination: undefined,
    stats: { total: 25, active: 15, inactive: 10 },
    rowCount: 0,
    loading: true,
  });

  assert.equal(loadingModel.isAuthoritative, false);
  assert.equal(loadingModel.isEstimated, true);
  assert.equal(loadingModel.page, 1);
  assert.equal(loadingModel.total, 15);
  assert.equal(loadingModel.totalPages, 2);
  assert.deepEqual(loadingModel.pages, [1, 2]);
  assert.equal(loadingModel.summaryRange, "1–10");
  assert.equal(loadingModel.summaryTotal, "15");
  // Navigation disabled during loading
  assert.equal(loadingModel.canPrev, false);
  assert.equal(loadingModel.canNext, false);

  // Once backend response settles with authoritative data:
  const settledModel = derivePaginationModel({
    query: { page: 1, pageSize: 10, status: "ACTIVE" },
    pagination: { page: 1, pageSize: 10, total: 15, totalPages: 2 },
    stats: { total: 25, active: 15, inactive: 10 },
    rowCount: 10,
    loading: false,
  });

  assert.equal(settledModel.isAuthoritative, true);
  assert.equal(settledModel.summaryRange, "1–10");
  assert.equal(settledModel.summaryTotal, "15");
  assert.deepEqual(settledModel.pages, [1, 2]);
  assert.equal(settledModel.canNext, true);
});

test("derivePaginationModel: edge cases - cold start, out of bounds page, and missing stats", () => {
  // Cold start without stats or pagination
  const coldModel = derivePaginationModel({
    query: { page: 1, pageSize: 10 },
    pagination: undefined,
    stats: undefined,
    rowCount: 0,
    loading: true,
  });
  assert.equal(coldModel.total, undefined);
  assert.equal(coldModel.summaryRange, "—");
  assert.equal(coldModel.summaryTotal, "—");
  assert.deepEqual(coldModel.pages, [1]);

  // Page 2 -> status switch -> page 1 with 1 page of active results
  const switchModel = derivePaginationModel({
    query: { page: 1, pageSize: 10, status: "ACTIVE" },
    pagination: undefined,
    stats: { total: 15, active: 3, inactive: 12 },
    rowCount: 0,
    loading: true,
  });
  assert.equal(switchModel.page, 1);
  assert.equal(switchModel.totalPages, 1);
  assert.equal(switchModel.summaryRange, "1–3");
  assert.equal(switchModel.summaryTotal, "3");

  // Requested page exceeds total pages in authoritative response: clamped cleanly
  const outOfBounds = derivePaginationModel({
    query: { page: 99, pageSize: 10 },
    pagination: { page: 99, pageSize: 10, total: 25, totalPages: 3 },
    stats: { total: 25, active: 20, inactive: 5 },
    rowCount: 5,
    loading: false,
  });
  assert.equal(outOfBounds.page, 3);
  assert.equal(outOfBounds.totalPages, 3);
  assert.equal(outOfBounds.from, 21);
  assert.equal(outOfBounds.to, 25);
  assert.equal(outOfBounds.summaryRange, "21–25");
});

test("Finding 05: CustomerPagination renders navigation buttons with data-press-effect='none'", () => {
  const html = render(
    React.createElement(CustomerPagination, {
      pagination: { page: 1, pageSize: 10, total: 20, totalPages: 2 },
      query: { page: 1, pageSize: 10 },
      rowCount: 10,
      loading: false,
      onQuery() {},
    }),
  );
  const matches = html.match(/data-press-effect="none"/g) || [];
  // Must render on First, Prev, Next, Last and individual page buttons
  assert.ok(matches.length >= 4);
});

test("estimated pagination renders stable numbers but disallows navigation after failed read", () => {
  const input = {
    query: { page: 1, pageSize: 20, status: "ACTIVE" },
    stats: { total: 35, active: 25, inactive: 10 },
    rowCount: 0,
    loading: false,
  };
  const model = derivePaginationModel(input);
  assert.equal(model.isEstimated, true);
  assert.deepEqual(model.pages, [1, 2]);
  assert.equal(model.canNext, false);
  assert.equal(model.canLast, false);
  const html = render(React.createElement(CustomerPagination, { ...input, onQuery() {} }));
  assert.match(html, /aria-label="Trang 2"[^>]*disabled/);
  assert.match(html, /aria-label="Trang sau"[^>]*disabled/);
});
