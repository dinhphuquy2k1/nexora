import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
import {
  SYNC_FIXTURE,
  PARITY_PROVIDERS,
} from "./fixtures/carrier-connections.ts";
const component = (path, name) =>
  loadComponent(new URL(`../features/${path}.tsx`, import.meta.url))[name];
const customer = component(
  "customers/CustomerPagination",
  "CustomerPagination",
);
const retail = component(
  "retail-packages/RetailPagination",
  "RetailPagination",
);
const carrier = component(
  "carrier-connections/CarrierConnectionList",
  "CarrierConnectionPagination",
);
const history = component(
  "carrier-connections/CarrierSyncPanels",
  "SyncHistoryPanel",
);
const noop = () => {};
const html = (c, p) => render(React.createElement(c, p));
test("all four consumers retain summary contracts and expose one genuine navigation landmark", () => {
  const cases = [
    [
      customer,
      {
        query: { page: 2, pageSize: 10 },
        pagination: { page: 2, pageSize: 10, total: 73, totalPages: 8 },
        rowCount: 10,
        loading: false,
        onQuery: noop,
      },
      "Phân trang khách hàng",
      "primary",
      16,
      /paginationBold[^>]*>11–20<\/strong>.*paginationBold[^>]*>73<\/strong>/s,
    ],
    [
      retail,
      {
        page: 2,
        pageSize: 10,
        total: 73,
        unavailable: false,
        onPage: noop,
        onSize: noop,
      },
      "Phân trang kiện lẻ",
      "emphasis",
      14,
      /data-retail-count="true">73 kiện lẻ/,
    ],
    [
      carrier,
      {
        model: { page: 2, pageSize: 10, total: 73, totalPages: 8 },
        known: true,
        onChange: noop,
      },
      "Trang tài khoản",
      "emphasis",
      14,
      /data-carrier-pagination/,
    ],
    [
      history,
      {
        data: {
          ...SYNC_FIXTURE,
          history: [],
          serverHistory: {
            total: 20,
            types: [],
            summary: { total: 20, completed: 20, running: 0, failed: 0 },
          },
        },
        query: {
          page: 2,
          type: "all",
          state: "all",
          range: "",
          appliedRange: "",
        },
        onChange: noop,
        onInspect: noop,
      },
      "Phân trang lịch sử",
      "emphasis",
      14,
      /Trang <strong>2<\/strong> \/ <strong>5<\/strong>/,
    ],
  ];
  for (const [c, p, label, variant, size, summary] of cases) {
    const s = html(c, p);
    assert.equal((s.match(/<nav /g) ?? []).length, 1);
    assert.match(s, new RegExp(`<nav[^>]*aria-label="${label}"`));
    if (label === "Phân trang kiện lẻ") {
      assert.doesNotMatch(s, /<div[^>]*aria-label="Phân trang kiện lẻ"/);
    }
    assert.doesNotMatch(s, /<nav[^>]*role="group"/);
    assert.match(s, summary);
    assert.match(
      s,
      new RegExp(
        `data-variant="${variant}"[^>]*aria-current|aria-current="page"[^>]*data-variant="${variant}"`,
      ),
    );
    assert.match(s, new RegExp(`width="${size}" height="${size}"`));
  }
});
test("history retains all pages through five, then bounded pageWindow, and no numbers when unknown", () => {
  const query = {
    page: 2,
    type: "all",
    state: "all",
    range: "",
    appliedRange: "",
  };
  for (const [total, count] of [
    [0, 1],
    [4, 1],
    [16, 4],
    [20, 5],
    [100, 4],
  ]) {
    const s = html(history, {
      data: {
        ...SYNC_FIXTURE,
        history: [],
        serverHistory: {
          total,
          types: [],
          summary: { total, completed: total, running: 0, failed: 0 },
        },
      },
      query,
      onChange: noop,
      onInspect: noop,
    });
    assert.equal(
      (s.match(/aria-label="Trang lịch sử \d+"/g) ?? []).length,
      count,
    );
  }
  const s = html(history, { query, onChange: noop, onInspect: noop });
  assert.doesNotMatch(s, /aria-label="Trang lịch sử \d+"/);
  assert.equal((s.match(/disabled=""/g) ?? []).length, 4);
});
test("both filters preserve accessible names and gain stable trigger/panel ID relationships", () => {
  const cases = [
    [
      "retail-packages/RetailFilterPopover",
      "RetailFilterPopover",
      { filters: [], onAdd: noop },
      "Bộ lọc nâng cao",
    ],
    [
      "carrier-connections/CarrierFilterPopover",
      "CarrierFilterPopover",
      {
        conditions: [],
        providers: PARITY_PROVIDERS,
        allowEnvironment: false,
        onAdd: noop,
      },
      "Thêm điều kiện lọc",
    ],
  ];
  for (const [path, name, props, label] of cases) {
    const s = html(component(path, name), props);
    assert.match(s, new RegExp(`aria-label="${label}"`));
    assert.match(s, /aria-controls="[^"]+"/);
    assert.match(s, /aria-expanded="false"/);
    assert.doesNotMatch(s, /role="dialog"/);
  }
});
