import test from "node:test";
import assert from "node:assert/strict";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const model = () =>
  loadComponent(
    new URL("../features/carrier-connections/presentation.ts", import.meta.url),
  );
const rows = Array.from({ length: 27 }, (_, i) => ({
  id: String(i),
  provider: i % 2 ? "uniship" : "fixture-b",
  providerName: i % 2 ? "Uniship" : "Hãng kiểm thử",
  displayName: `Chi nhánh ${i}`,
  loginIdentifier: `fixture-${i}`,
  status: ["CONNECTED", "ERROR", "REAUTH_REQUIRED"][i % 3],
  lastVerifiedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
}));
test("carrier read model combines filters and clamps stale pagination without mutation", () => {
  const { selectConnections } = model();
  const input = JSON.stringify(rows);
  const all = selectConnections(rows, {
    search: "",
    provider: "all",
    status: "all",
    page: 2,
    pageSize: 20,
  });
  assert.equal(all.rows.length, 7);
  assert.equal(all.total, 27);
  assert.equal(all.start, 21);
  const found = selectConnections(rows, {
    search: "  CHI NHÁNH 1 ",
    provider: "uniship",
    status: "ERROR",
    page: 99,
    pageSize: 5,
  });
  assert.ok(found.rows.length > 0);
  assert.ok(
    found.rows.every(
      (r) =>
        r.provider === "uniship" &&
        r.status === "ERROR" &&
        r.displayName.includes("1"),
    ),
  );
  assert.ok(found.page <= found.totalPages);
  assert.equal(
    selectConnections(rows, {
      search: "no-match",
      provider: "all",
      status: "all",
      page: 4,
      pageSize: 20,
    }).start,
    0,
  );
  assert.equal(JSON.stringify(rows), input);
});
test("local credential validation never represents a successful operation", () => {
  const { validateConnectionDraft } = model();
  assert.equal(
    Object.keys(
      validateConnectionDraft({
        displayName: " ",
        loginIdentifier: "",
        password: "",
      }),
    ).length,
    3,
  );
  assert.deepEqual(
    Object.keys(
      validateConnectionDraft({
        displayName: "Chi nhánh",
        loginIdentifier: "fixture",
        password: "synthetic-only",
      }),
    ),
    [],
  );
  assert.ok(
    validateConnectionDraft({
      displayName: "x".repeat(101),
      loginIdentifier: "fixture",
      password: "synthetic-only",
    }).displayName,
  );
});
test("production carrier page has no fabricated records/counts/success and remains unavailable", () => {
  const { CarrierConnectionsPage } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionsPage.tsx",
      import.meta.url,
    ),
  );
  const html = render(React.createElement(CarrierConnectionsPage));
  assert.match(html, /KẾT NỐI HÃNG VẬN CHUYỂN/);
  assert.match(html, /Chưa tích hợp dữ liệu/);
  assert.doesNotMatch(
    html,
    /fixture-|sk_live|Kết nối thành công|Đồng bộ thành công/,
  );
  assert.equal((html.match(/<col\b/g) ?? []).length, 7);
  assert.doesNotMatch(html, /aria-current="page"|1 \/ 1/);
});

test("new connection uses Uniship credentials with no API-key or save-success contract", () => {
  const { CarrierConnectionDrawer } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionDrawer.tsx",
      import.meta.url,
    ),
  );
  const html = render(
    React.createElement(CarrierConnectionDrawer, { onClose: () => {} }),
  );
  assert.match(html, /type="password"/);
  assert.match(html, /Tên đăng nhập hãng/);
  assert.match(html, /Uniship/);
  assert.match(html, /không được lưu/);
  assert.doesNotMatch(html, /API Key|sk_live|Kết nối thành công|localStorage/);
});
test("default sync has unavailable status and backend actions, no running progress", () => {
  const { CarrierDataSyncDrawer } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierDataSyncDrawer.tsx",
      import.meta.url,
    ),
  );
  const html = render(
    React.createElement(CarrierDataSyncDrawer, { onClose: () => {} }),
  );
  assert.match(html, /Lịch tự động/);
  assert.match(html, /Lịch sử đồng bộ/);
  assert.match(html, /Chưa khả dụng/);
  assert.doesNotMatch(html, /<progress|Đang đồng bộ|1240|2026/);
});
test("production feature does not import fixtures or call network, timers, storage or SDK operations", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = new URL("../features/carrier-connections/", import.meta.url);
  for (const file of await readdir(dir)) {
    if (!/\.tsx?$/.test(file)) continue;
    const text = await readFile(new URL(file, dir), "utf8");
    assert.doesNotMatch(
      text,
      /fixtures|createNexoraClient|fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|setTimeout|setInterval/,
      file,
    );
  }
  const page = await readFile(
    new URL(
      "../app/(workspace)/settings/carrier-connections/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(page, /fixtures|fetch\s*\(|records=|syncByConnection=/);
});

test("table renders supplied stream status/progress but never invents unavailable summaries", () => {
  const { CarrierConnectionTable } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionList.tsx",
      import.meta.url,
    ),
  );
  const props = {
    model: model().selectConnections(rows.slice(0, 1), model().INITIAL_QUERY),
    known: true,
    onAction: () => {},
  };
  const injected = render(
    React.createElement(CarrierConnectionTable, {
      ...props,
      sync: {
        0: {
          items: [
            {
              id: "shipment",
              label: "Kiện hàng",
              state: "running",
              progress: 43,
            },
          ],
          history: [],
        },
      },
    }),
  );
  assert.match(injected, /Đang đồng bộ/);
  assert.match(injected, /43/);
  assert.match(injected, /<progress/);
  const absent = render(
    React.createElement(CarrierConnectionTable, { ...props, sync: {} }),
  );
  assert.match(absent, /Chưa khả dụng/);
  assert.doesNotMatch(absent, /<progress|Đang đồng bộ/);
});

test("last successful sync uses the newest valid stream timestamp, never first-row order", () => {
  const { latestSyncSuccess } = model();
  assert.equal(latestSyncSuccess(undefined), null);
  assert.equal(
    latestSyncSuccess({ items: [{ lastSuccess: "invalid" }], history: [] }),
    null,
  );
  assert.equal(
    latestSyncSuccess({
      items: [
        { lastSuccess: "2026-01-01T00:00:00Z" },
        { lastSuccess: "invalid" },
        { lastSuccess: "2026-02-01T00:00:00Z" },
        { lastSuccess: "2025-12-01T00:00:00Z" },
      ],
      history: [],
    }),
    "2026-02-01T00:00:00Z",
  );
});
