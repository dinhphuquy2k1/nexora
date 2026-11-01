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
  const { selectConnections, INITIAL_QUERY, makeCarrierFilter } = model();
  const input = JSON.stringify(rows);
  const all = selectConnections(rows, {
    search: "",
    ...INITIAL_QUERY,
    page: 2,
    pageSize: 20,
  });
  assert.equal(all.rows.length, 7);
  assert.equal(all.total, 27);
  assert.equal(all.start, 21);
  const found = selectConnections(rows, {
    ...INITIAL_QUERY,
    search: "  CHI NHÁNH 1 ",
    conditions: [
      makeCarrierFilter("carrier", "equals", "uniship"),
      makeCarrierFilter("status", "equals", "error"),
    ],
    page: 99,
    pageSize: 5,
  });
  assert.ok(found.rows.length > 0);
  assert.ok(
    found.rows.every(
      (r) =>
        r.provider === "uniship" &&
        (r.status === "ERROR" || r.status === "REAUTH_REQUIRED") &&
        r.displayName.includes("1"),
    ),
  );
  assert.ok(found.page <= found.totalPages);
  assert.equal(
    selectConnections(rows, {
      ...INITIAL_QUERY,
      search: "no-match",
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
  assert.match(html, /Tên đăng nhập \/ Mã tài khoản hãng/);
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

test("ZIP v2 production deck has three header actions, source tabs/popover and no extra availability banner", () => {
  const { CarrierConnectionsPage } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionsPage.tsx",
      import.meta.url,
    ),
  );
  const html = render(React.createElement(CarrierConnectionsPage));
  assert.match(html, /data-carrier-command-deck/);
  assert.match(html, /data-carrier-table-container/);
  for (const text of [
    "Xuất Excel",
    "Thêm điều kiện lọc",
    "Đang hoạt động",
    "Cần kiểm tra",
    "Sandbox",
  ])
    assert.match(html, new RegExp(text));
  assert.doesNotMatch(
    html,
    /Xem giao diện đồng bộ|Lọc hãng vận chuyển|Lọc trạng thái kết nối/,
  );
});
test("ZIP v2 defaults to10 and combines needs-check statuses without inventing domain states", () => {
  const { INITIAL_QUERY, selectConnections } = model();
  assert.equal(INITIAL_QUERY.pageSize, 10);
  const data = selectConnections(rows, {
    ...INITIAL_QUERY,
    tab: "needs_check",
  });
  assert.equal(data.total, 18);
  assert.ok(data.rows.every((r) => r.status !== "CONNECTED"));
  assert.equal(
    selectConnections(rows, { ...INITIAL_QUERY, tab: "sandbox" }).total,
    0,
  );
});
test("ZIP v2 advanced filters support AND/not/contains, reject duplicates and preserve input", () => {
  const {
    INITIAL_QUERY,
    makeCarrierFilter,
    addCarrierFilter,
    selectConnections,
  } = model();
  const a = makeCarrierFilter("carrier", "equals", "uniship"),
    b = makeCarrierFilter("accountName", "contains", "1");
  assert.ok(a && b);
  const filters = addCarrierFilter([a], b);
  assert.equal(addCarrierFilter(filters, a), null);
  const found = selectConnections(rows, {
    ...INITIAL_QUERY,
    conditions: filters,
  });
  assert.ok(found.total > 0);
  assert.ok(
    found.rows.every(
      (r) => r.provider === "uniship" && r.displayName.includes("1"),
    ),
  );
  assert.equal(makeCarrierFilter("accountName", "contains", "   "), null);
  assert.equal(makeCarrierFilter("carrier", "contains", "uniship"), null);
});

test("ZIP v2 details are centered and sync footer never contains a global sync action", () => {
  const { CarrierConnectionDetails } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionDrawer.tsx",
      import.meta.url,
    ),
  );
  const html = render(
    React.createElement(CarrierConnectionDetails, {
      row: rows[0],
      onClose: () => {},
    }),
  );
  assert.doesNotMatch(html, /class="[^"]*\bside\b/);
  assert.match(html, /Môi trường/);
  assert.doesNotMatch(html, /Ủy quyền API đã kích hoạt|Đẩy đơn/);
  const { CarrierDataSyncDrawer } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierDataSyncDrawer.tsx",
      import.meta.url,
    ),
  );
  const sync = render(
    React.createElement(CarrierDataSyncDrawer, { onClose: () => {} }),
  );
  const footer = sync.match(/<footer[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footer);
  assert.match(footer, /Đóng/);
  assert.doesNotMatch(footer, /Đồng bộ ngay/);
});
test("schedule dirty state and history calendar filters never imply persistence", () => {
  const { initialSchedule, scheduleDirty, filterSyncHistory } = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  const base = initialSchedule([
    { id: "shipment", autoEnabled: true, autoInterval: "120" },
  ]);
  assert.equal(scheduleDirty(base, base), false);
  assert.equal(
    scheduleDirty(base, { shipment: { enabled: false, interval: "120" } }),
    true,
  );
  const input = [
    {
      id: "1",
      dataType: "Shipment",
      state: "failed",
      startedAt: "2026-10-08T17:30:00Z",
    },
    {
      id: "2",
      dataType: "Customer",
      state: "completed",
      startedAt: "2026-10-09T18:00:00Z",
    },
  ];
  assert.deepEqual(
    filterSyncHistory(
      input,
      "Shipment",
      "failed",
      "09/10/2026 - 09/10/2026",
    ).entries.map((r) => r.id),
    ["1"],
  );
  assert.ok(
    filterSyncHistory(input, "all", "all", "31/02/2026 - 02/03/2026").error,
  );
  assert.ok(
    filterSyncHistory(input, "all", "all", "10/10/2026 - 09/10/2026").error,
  );
  assert.equal(input.length, 2);
});

test("unknown environment never matches even a negative environment filter", () => {
  const { INITIAL_QUERY, selectConnections, makeCarrierFilter } = model();
  for (const operator of ["equals", "not_equals"]) {
    const condition = makeCarrierFilter("environment", operator, "sandbox");
    assert.ok(condition);
    assert.equal(
      selectConnections(rows, { ...INITIAL_QUERY, conditions: [condition] })
        .total,
      0,
    );
  }
  const fixture = { ...rows[0], preview: { environment: "sandbox" } };
  assert.equal(
    selectConnections([fixture], { ...INITIAL_QUERY, tab: "sandbox" }).total,
    1,
  );
});

test("ZIP geometry specification accounts for every required surface and viewport", async () => {
  const { readFile } = await import("node:fs/promises");
  const contract = JSON.parse(
    await readFile(
      new URL("./fixtures/carrier-zip-geometry.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    contract.zipSha256,
    "6912f4917756a1c3393e48b34f63f350464cb068351a377c2efb9d5cde6d5a52",
  );
  assert.deepEqual(
    contract.sizes.map((s) => [s.width, s.height]),
    [
      [1440, 900],
      [1280, 800],
      [1024, 768],
      [768, 1024],
      [390, 844],
      [375, 812],
    ],
  );
  assert.deepEqual(
    contract.surfaces.map((s) => s.surface),
    [
      "list",
      "filter",
      "actions",
      "create",
      "edit",
      "details",
      "disconnect",
      "sync-status",
      "sync-schedule",
      "sync-history",
      "sync-expanded",
      "progress",
      "error",
      "history-details",
    ],
  );
  assert.ok(
    contract.sizes.every(
      (s) => s.columnWidths.length === 7 && s.rowHeights.length === 3,
    ),
  );
  assert.ok(contract.surfaces.every((s) => s.frameWidths.length === 6));
  assert.ok(
    contract.surfaces
      .filter((s) => s.surface.startsWith("sync-"))
      .every(
        (s) =>
          s.frameHeaderHeights?.length === 6 &&
          s.frameHeaderHeights.every((h) => Number.isFinite(h) && h > 0),
      ),
  );
});

test("progress inspection keeps its stream title and supplied Job ID in source header", () => {
  const { CarrierSyncInspection } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierSyncInspection.tsx",
      import.meta.url,
    ),
  );
  const html = render(
    React.createElement(CarrierSyncInspection, {
      inspection: {
        kind: "progress",
        item: {
          id: "shipment",
          label: "Shipment",
          state: "running",
          jobId: "fixture-job-42",
          progress: 43,
        },
      },
      onClose: () => {},
    }),
  );
  assert.match(
    html,
    /<header[\s\S]*Tiến trình đồng bộ Shipment[\s\S]*Job ID: fixture-job-42[\s\S]*<\/header>/,
  );
  assert.equal((html.match(/fixture-job-42/g) ?? []).length, 1);
});

test("history preserves whole-card native actions and its distinct running status presentation", () => {
  const { SyncHistoryPanel } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierSyncPanels.tsx",
      import.meta.url,
    ),
  );
  const { PARITY_SYNC } = loadComponent(
    new URL("./fixtures/carrier-connections.ts", import.meta.url),
  );
  const html = render(
    React.createElement(SyncHistoryPanel, {
      data: PARITY_SYNC,
      query: {
        type: "all",
        state: "all",
        range: PARITY_SYNC.historyRange,
        appliedRange: PARITY_SYNC.historyRange,
        page: 1,
      },
      onChange: () => {},
      onInspect: () => {},
    }),
  );
  assert.match(
    html,
    /<button[^>]+data-carrier-history-id="1"[\s\S]*data-context="history"[\s\S]*Đang chạy[\s\S]*Bắt đầu:[\s\S]*<\/button>/,
  );
  const card = html.match(
    /<button[^>]+data-carrier-history-id="1"[\s\S]*?<\/button>/,
  )?.[0];
  assert.ok(card);
  assert.equal((card.match(/<button\b/g) ?? []).length, 1);
  assert.doesNotMatch(card, /aria-label=/);
  assert.match(card, /Chi tiết lượt đồng bộ 1/);
  assert.equal((html.match(/data-carrier-history-id="\d+"/g) ?? []).length, 4);
});
