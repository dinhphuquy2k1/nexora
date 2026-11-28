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
test("Carrier presentation stays isolated; SDK reads and bounded polling have explicit owners", async () => {
  const { readdir, readFile } = await import("node:fs/promises");
  const dir = new URL("../features/carrier-connections/", import.meta.url);
  for (const file of await readdir(dir)) {
    if (!/\.tsx?$/.test(file)) continue;
    const text = await readFile(new URL(file, dir), "utf8");
    assert.doesNotMatch(
      text,
      /fixtures|fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|setInterval/,
      file,
    );
    if (file !== "sync-api.ts")
      assert.doesNotMatch(text, /createNexoraClient/, file);
    if (file !== "CarrierLiveSyncDrawer.tsx")
      assert.doesNotMatch(text, /setTimeout/, file);
    else {
      assert.match(text, /clearTimeout/);
      assert.match(text, /AbortController/);
    }
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

test("toolbar does not render inline 'Đang lọc' or 'Xóa lọc', preserving layout stability across tab switches", () => {
  const { CarrierConnectionToolbar } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionList.tsx",
      import.meta.url,
    ),
  );
  const { INITIAL_QUERY, makeCarrierFilter } = model();
  const htmlFiltered = render(
    React.createElement(CarrierConnectionToolbar, {
      query: {
        ...INITIAL_QUERY,
        tab: "connected",
        search: "test",
        conditions: [makeCarrierFilter("carrier", "equals", "uniship")],
      },
      providers: [{ id: "uniship", name: "Uniship", code: "UNI" }],
      known: true,
      allowEnvironment: true,
      onChange: () => {},
      onAdd: () => false,
    }),
  );
  assert.doesNotMatch(htmlFiltered, /Đang lọc/);
  assert.doesNotMatch(htmlFiltered, /Xóa lọc/);
  assert.doesNotMatch(htmlFiltered, /filterIndicator/);
  // Filter chips row is rendered when conditions exist
  assert.match(htmlFiltered, /Xóa tất cả/);
  assert.match(htmlFiltered, /Hãng vận chuyển/);
});

test("pagination footer aligns with Retail baseline: disabled page 1 when unavailable, numbered pagination when known", () => {
  const { CarrierConnectionPagination } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionList.tsx",
      import.meta.url,
    ),
  );
  const { selectConnections, INITIAL_QUERY } = model();

  // 1. Unavailable state (production, no backend)
  const unavailableModel = selectConnections([], INITIAL_QUERY);
  const htmlUnavailable = render(
    React.createElement(CarrierConnectionPagination, {
      model: unavailableModel,
      known: false,
      onChange: () => {},
    }),
  );

  // Summary shows em-dash and does not invent counts
  assert.match(htmlUnavailable, /Hiển thị[\s\S]*?<strong[^>]*>—<\/strong>/);
  assert.match(htmlUnavailable, /data-carrier-count="true">— tài khoản/);
  // Geometry preserves disabled button 1 without asserting active page
  assert.match(htmlUnavailable, /<button[^>]+disabled=""[^>]*>1<\/button>/);
  assert.doesNotMatch(htmlUnavailable, /aria-current="page"/);
  // All navigation arrows disabled
  assert.match(
    htmlUnavailable,
    /aria-label="Trang đầu tài khoản"[^>]+disabled=""/,
  );
  assert.match(
    htmlUnavailable,
    /aria-label="Trang cuối tài khoản"[^>]+disabled=""/,
  );

  // 2. Known state (populated fixture)
  const knownModel = selectConnections(rows, { ...INITIAL_QUERY, pageSize: 5 });
  const htmlKnown = render(
    React.createElement(CarrierConnectionPagination, {
      model: knownModel,
      known: true,
      onChange: () => {},
    }),
  );

  assert.match(htmlKnown, /Hiển thị[\s\S]*?<strong[^>]*>1–5<\/strong>/);
  assert.match(
    htmlKnown,
    new RegExp(`data-carrier-count="true">${rows.length} tài khoản`),
  );
  assert.match(htmlKnown, /aria-current="page"[^>]*>1<\/button>/);
  assert.match(htmlKnown, /Trang tài khoản 2/);
});

test("connection status stays independent of environment for every status", () => {
  const { ConnectionBadge } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionList.tsx",
      import.meta.url,
    ),
  );
  const { CONNECTION_STATES } = model();
  for (const status of ["CONNECTED", "ERROR", "REAUTH_REQUIRED"])
    for (const environment of ["production", "sandbox"]) {
      const html = render(
        React.createElement(ConnectionBadge, {
          row: { ...rows[0], status, preview: { environment } },
        }),
      );
      assert.ok(
        html.includes(CONNECTION_STATES[status].label),
        `${status}/${environment}`,
      );
      assert.doesNotMatch(html, /Sandbox|Production/);
    }
});

test("history options preserve every actual raw data type without duplicates", () => {
  const { historyDataTypes } = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  assert.deepEqual(
    Array.from(
      historyDataTypes([
        { dataType: "Shipment" },
        { dataType: "Khách hàng" },
        { dataType: "Tracking" },
        { dataType: "Shipment" },
        { dataType: "Kiện hàng" },
      ]),
    ),
    ["Shipment", "Khách hàng", "Tracking", "Kiện hàng"],
  );
});

test("history validates timezone-qualified timestamps even without a date filter", () => {
  const { filterSyncHistory } = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  for (const startedAt of [
    undefined,
    "",
    "2026-02-30T12:00:00+07:00",
    "2026-10-09T12:00:00",
    "2026-10-09T25:00:00Z",
    "2026-10-09T12:00:00+25:00",
  ]) {
    const result = filterSyncHistory(
      [
        {
          id: "bad",
          startedAt,
          dataType: "Tracking",
          state: "failed",
          time: "09/10/2026 12:00",
        },
      ],
      "all",
      "all",
      "",
    );
    assert.ok(result.error, `${startedAt} must report validation failure`);
    assert.equal(result.entries.length, 0);
  }
  const entries = [
    {
      id: "before",
      startedAt: "2026-10-08T16:59:59.999Z",
      dataType: "Tracking",
      state: "failed",
    },
    {
      id: "start",
      startedAt: "2026-10-09T00:00:00+07:00",
      dataType: "Tracking",
      state: "failed",
    },
    {
      id: "end",
      startedAt: "2026-10-09T16:59:59.999Z",
      dataType: "Tracking",
      state: "failed",
    },
    {
      id: "after",
      startedAt: "2026-10-10T00:00:00+07:00",
      dataType: "Tracking",
      state: "failed",
    },
    {
      id: "other",
      startedAt: "2026-10-09T03:00:00Z",
      dataType: "Kiện hàng",
      state: "completed",
    },
  ];
  const result = filterSyncHistory(
    entries,
    "Tracking",
    "failed",
    "09/10/2026 - 09/10/2026",
  );
  assert.equal(result.error, "");
  assert.deepEqual(
    result.entries.map((e) => e.id),
    ["start", "end"],
  );
});

test("strict history timestamps preserve early years and reject calendar/time rollover", () => {
  const { parseSyncStartedAt, filterSyncHistory } = loadComponent(
    new URL(
      "../features/carrier-connections/sync-presentation.ts",
      import.meta.url,
    ),
  );
  for (const value of [
    "0001-01-01T00:00:00Z",
    "0099-12-31T23:59:59+07:00",
    "2024-02-29T12:30:45.123456Z",
    "2026-10-09T23:59:59.999+07:00",
  ])
    assert.notEqual(parseSyncStartedAt(value), null, value);
  for (const value of [
    "2025-02-29T00:00:00Z",
    "2026-04-31T12:00:00Z",
    "2026-10-09T24:00:00Z",
    "2026-10-09T12:60:00Z",
    "2026-10-09T12:00:00+07:60",
  ])
    assert.equal(parseSyncStartedAt(value), null, value);
  const entry = {
    id: "early",
    startedAt: "0001-01-01T00:00:00+07:00",
    dataType: "Khách hàng",
    state: "completed",
  };
  assert.equal(
    filterSyncHistory([entry], "all", "all", "01/01/0001 - 01/01/0001").entries
      .length,
    1,
  );
});

test("history component renders actual type options and exposes invalid data timestamps", () => {
  const { SyncHistoryPanel } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierSyncPanels.tsx",
      import.meta.url,
    ),
  );
  const data = {
    items: [],
    history: [
      {
        id: "bad",
        time: "Display only",
        startedAt: "not-iso",
        dataType: "Tracking",
        source: "Test",
        state: "completed",
        detail: "",
      },
      {
        id: "vi",
        time: "Display only",
        startedAt: "2026-10-09T00:00:00+07:00",
        dataType: "Khách hàng",
        source: "Test",
        state: "completed",
        detail: "",
      },
    ],
  };
  const html = render(
    React.createElement(SyncHistoryPanel, {
      data,
      query: {
        type: "all",
        state: "all",
        range: "",
        appliedRange: "",
        page: 99,
      },
      onChange: () => {},
      onInspect: () => {},
    }),
  );
  assert.match(html, /<option value="Tracking">Tracking<\/option>/);
  assert.match(html, /<option value="Khách hàng">Khách hàng<\/option>/);
  assert.match(
    html,
    /<p role="alert"[^>]*>Dữ liệu lịch sử có thời điểm bắt đầu không hợp lệ\./,
  );
  assert.doesNotMatch(html, /data-carrier-history-id=/);
});

test("live Carrier lifecycle callbacks enable connect, edit/reconnect, disconnect and refresh while callback-less renders remain draft-only", async () => {
  const { CarrierConnectionsPage } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionsPage.tsx",
      import.meta.url,
    ),
  );
  const { CarrierConnectionDrawer, CarrierConfirmDialog } = loadComponent(
    new URL(
      "../features/carrier-connections/CarrierConnectionDrawer.tsx",
      import.meta.url,
    ),
  );

  // 1. Live mode page enables refresh controls while keeping draft-only offline renders disabled
  const livePageHtml = render(
    React.createElement(CarrierConnectionsPage, {
      records: rows.slice(0, 1),
      liveSync: true,
      onRefresh: () => {},
      onConnect: async () => {},
    }),
  );
  const refreshMatch = livePageHtml.match(
    /<button[^>]+aria-label="Làm mới trạng thái"[^>]*>/,
  )?.[0];
  assert.ok(refreshMatch);
  assert.doesNotMatch(refreshMatch, /disabled/);

  // 2. Live create drawer updates help copy and allows submit once valid
  const liveCreateHtml = render(
    React.createElement(CarrierConnectionDrawer, {
      onClose: () => {},
      onSubmit: async () => {},
    }),
  );
  assert.doesNotMatch(
    liveCreateHtml,
    /Thông tin chỉ là bản nháp, không được lưu/,
  );
  assert.match(liveCreateHtml, /Kích hoạt kết nối/);

  // 3. Edit mode locks loginIdentifier cleanly and live disconnect enables confirmation action
  const liveEditHtml = render(
    React.createElement(CarrierConnectionDrawer, {
      row: rows[1],
      onClose: () => {},
      onSubmit: async () => {},
    }),
  );
  const loginInput = liveEditHtml.match(
    /<input[^>]*name="loginIdentifier"[^>]*>/,
  )?.[0];
  assert.ok(loginInput);
  assert.match(loginInput, /\bdisabled\b/);
  const confirmHtml = render(
    React.createElement(CarrierConfirmDialog, {
      row: rows[1],
      onClose: () => {},
      onConfirm: async () => {},
    }),
  );
  const confirmBtn = confirmHtml.match(
    /<button[^>]*>Xác nhận ngắt kết nối<\/button>/,
  )?.[0];
  assert.ok(confirmBtn);
  assert.doesNotMatch(confirmBtn, /disabled/);
});

test("CarrierConnectionDrawer live submission trims metadata, retains password raw, guards concurrent submits and clears password on success", async () => {
  const r = lifecycleRig();
  await r.open("create");
  r.fill("displayName", "  Uniship Chính  ");
  r.fill("loginIdentifier", "  synthetic  ");
  r.fill("password", " pass-raw ");
  let release;
  r.state.writeWait = new Promise((resolve) => {
    release = resolve;
  });
  const first = r.submit();
  await r.submit();
  const writes = r.requests.filter((x) => x.method === "POST");
  assert.equal(writes.length, 1, "concurrent double submit blocked");
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].options.body)), {
    provider: "uniship",
    displayName: "Uniship Chính",
    loginIdentifier: "synthetic",
    password: " pass-raw ",
  });
  release();
  await first;
  assert.equal(r.closes, 1);
  const retained = r.drawer.render({ onClose() {}, onSubmit: async () => {} });
  assert.equal(
    nodes(retained, (n) => n.type === "input" && n.props.name === "password")[0]
      .props.value,
    "",
  );
});

test("CarrierConnectionsLive hydrates sync summaries tolerantly and exposes lifecycle refresh", async () => {
  const { componentHarness } = await import("./helpers/component-harness.mjs");
  const { syncPresentation } = loadComponent(
    new URL(
      "../features/carrier-connections/sync-response.ts",
      import.meta.url,
    ),
  );
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const api = {
    connections: async () => [
      {
        id: "conn-1",
        provider: "uniship",
        externalAccountId: "88001",
        loginIdentifier: "synthetic",
        displayName: "Uniship Chính",
        status: "CONNECTED",
        lastVerifiedAt: "2026-11-28T00:00:00Z",
        createdAt: "2026-11-28T00:00:00Z",
      },
    ],
    configs: async () => {
      throw new Error("summary temporary unavailable");
    },
    jobs: async () => ({
      jobs: [],
      total: 0,
      types: [],
      summary: { total: 0, completed: 0, running: 0, failed: 0 },
    }),
    connect: async () => ({ id: "conn-1" }),
    reconnect: async () => ({ id: "conn-1" }),
    rename: async () => ({ id: "conn-1" }),
    remove: async () => ({ success: true }),
  };

  class MockSyncApiError extends Error {
    constructor(status, message, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  const harness = componentHarness(
    "../features/carrier-connections/CarrierConnectionsLive.tsx",
    {
      "@nexora/ui": { Button: "button" },
      "./sync-api.ts": {
        createSyncApi: () => api,
        SyncApiError: MockSyncApiError,
      },
      "./edit-error.ts": editErrorDependency,
      "./sync-response.ts": { syncPresentation },
      "./CarrierConnectionsPage.tsx": { CarrierConnectionsPage: "page" },
    },
  );

  harness.render({});
  await tick();
  await tick();
  const tree = harness.render({});
  const pageEl = tree.props.children.find((c) => c && c.type === "page");
  const capturedProps = pageEl.props;
  assert.equal(capturedProps.records.length, 1);
  assert.equal(typeof capturedProps.onConnect, "function");
  assert.equal(typeof capturedProps.onEditConnection, "function");
  assert.equal(typeof capturedProps.onDisconnect, "function");
  assert.equal(typeof capturedProps.onRefresh, "function");
});

// Stateful lifecycle regressions run actual Live/Page/Drawer closures, never a provider.
const { componentHarness } = await import("./helpers/component-harness.mjs");
const { createSyncApi, SyncApiError: LifecycleApiError } = loadComponent(
  new URL("../features/carrier-connections/sync-api.ts", import.meta.url),
);
const editErrorDependency = loadComponent(
  new URL("../features/carrier-connections/edit-error.ts", import.meta.url),
);
function nodes(node, predicate, result = []) {
  if (Array.isArray(node)) {
    for (const child of node) nodes(child, predicate, result);
  } else if (node && typeof node === "object") {
    if (predicate(node)) result.push(node);
    for (const child of Object.values(node.props ?? {}))
      nodes(child, predicate, result);
  }
  return result;
}
const one = (tree, type) => nodes(tree, (n) => n.type === type)[0];
const tickLifecycle = () => new Promise((resolve) => setTimeout(resolve, 0));
const syntheticRow = {
  ...rows[1],
  id: "synthetic-connection",
  status: "CONNECTED",
  displayName: "Original",
};
function lifecycleRig() {
  const requests = [];
  const state = {
    name: "Original",
    rename: "ok",
    reconnect: "ok",
    remove: "ok",
    connect: "ok",
    readFailure: false,
  };
  const client = Object.fromEntries(
    ["GET", "POST", "PATCH", "DELETE"].map((method) => [
      method,
      async (path, options = {}) => {
        requests.push({ method, path, options });
        if (method === "GET") {
          if (state.readWait) await state.readWait;
          if (state.readFailure) throw Error("synthetic read unavailable");
          if (path === "/api/carrier-connections")
            return {
              response: { ok: true },
              data: {
                connections: [{ ...syntheticRow, displayName: state.name }],
              },
            };
          if (path.endsWith("sync-configs"))
            return { response: { ok: true }, data: { configs: [] } };
          return {
            response: { ok: true },
            data: {
              jobs: [],
              total: 0,
              types: [],
              summary: { total: 0, completed: 0, running: 0, failed: 0 },
            },
          };
        }
        if (state.writeWait) await state.writeWait;
        const mode =
          method === "PATCH"
            ? state.rename
            : method === "DELETE"
              ? state.remove
              : path.endsWith("reconnect")
                ? state.reconnect
                : state.connect;
        if (method === "PATCH" && (mode === "ok" || mode === "commit-error"))
          state.name = options.body.displayName;
        if (mode === "network") throw Error("synthetic transport unavailable");
        if (mode === "malformed") return { response: { ok: true } };
        if (mode === "malformed-nested")
          return { response: { ok: true }, data: {} };
        if (typeof mode === "number" || mode === "commit-error")
          return {
            response: {
              ok: false,
              status: typeof mode === "number" ? mode : 503,
            },
            error: { code: "FORBIDDEN" },
          };
        return {
          response: { ok: true },
          data: {
            connection: { ...syntheticRow, displayName: state.name },
            success: true,
          },
        };
      },
    ]),
  );
  const api = createSyncApi(client);
  const live = componentHarness(
    "../features/carrier-connections/CarrierConnectionsLive.tsx",
    {
      "@nexora/ui": { Button: "button" },
      "./sync-api.ts": {
        createSyncApi: () => api,
        SyncApiError: LifecycleApiError,
      },
      "./edit-error.ts": editErrorDependency,
      "./sync-response.ts": loadComponent(
        new URL(
          "../features/carrier-connections/sync-response.ts",
          import.meta.url,
        ),
      ),
      "./CarrierConnectionsPage.tsx": { CarrierConnectionsPage: "page" },
    },
  );
  const drawerDeps = {
    "@nexora/ui": { Overlay: "overlay", Button: "button", TextInput: "input" },
    "lucide-react": Object.fromEntries(
      [
        "X",
        "Truck",
        "KeyRound",
        "Lock",
        "Activity",
        "Check",
        "AlertCircle",
        "ShieldCheck",
      ].map((x) => [x, x]),
    ),
    "./presentation.ts": model(),
    "./sync-api.ts": { SyncApiError: LifecycleApiError },
    "./edit-error.ts": editErrorDependency,
    "./CarrierConnectionList.tsx": {
      CarrierLogo: "logo",
      ConnectionBadge: "badge",
    },
  };
  const page = componentHarness(
    "../features/carrier-connections/CarrierConnectionsPage.tsx",
    {
      "next/link": { default: "a" },
      "@nexora/ui": {
        Button: "button",
        TabBar: "tabs",
        TabCountBadge: "count",
        buttonClassName: () => "",
      },
      "lucide-react": Object.fromEntries(
        [
          "Truck",
          "Plus",
          "RefreshCw",
          "Layers",
          "ShieldCheck",
          "AlertTriangle",
          "Link2",
          "ArrowLeft",
          "FileSpreadsheet",
        ].map((x) => [x, x]),
      ),
      "./presentation.ts": model(),
      "./CarrierConnectionList.tsx": {
        CarrierConnectionToolbar: "toolbar",
        CarrierConnectionTable: "table",
        CarrierConnectionPagination: "pager",
      },
      "./CarrierConnectionDrawer.tsx": {
        CarrierConnectionDrawer: "drawer",
        CarrierConnectionDetails: "details",
        CarrierConfirmDialog: "confirm",
      },
      "./CarrierDataSyncDrawer.tsx": { CarrierDataSyncDrawer: "sync" },
      "./CarrierLiveSyncDrawer.tsx": { CarrierLiveSyncDrawer: "live-sync" },
    },
  );
  const drawer = componentHarness(
    "../features/carrier-connections/CarrierConnectionDrawer.tsx",
    drawerDeps,
    "CarrierConnectionDrawer",
  );
  const confirm = componentHarness(
    "../features/carrier-connections/CarrierConnectionDrawer.tsx",
    drawerDeps,
    "CarrierConfirmDialog",
  );
  const pageProps = () => one(live.render({}), "page").props;
  const renderPage = () => page.render(pageProps());
  let mode = "edit",
    closes = 0;
  const props = () => {
    const n = one(renderPage(), mode === "disconnect" ? "confirm" : "drawer");
    assert.ok(n, "surface remains mounted");
    return {
      ...n.props,
      onClose() {
        closes++;
        n.props.onClose();
      },
    };
  };
  const view = () => (mode === "disconnect" ? confirm : drawer).render(props());
  return {
    state,
    requests,
    live,
    drawer,
    get closes() {
      return closes;
    },
    async open(action = "edit") {
      mode = action;
      live.render({});
      await tickLifecycle();
      await tickLifecycle();
      if (action === "create")
        nodes(
          renderPage(),
          (n) =>
            n.type === "button" &&
            JSON.stringify(n.props.children).includes("Kết nối hãng mới"),
        )[0].props.onClick();
      else one(renderPage(), "table").props.onAction(action, syntheticRow);
      return view();
    },
    view,
    pageProps,
    fill(name, value) {
      nodes(
        view(),
        (n) => n.type === "input" && n.props.name === name,
      )[0].props.onChange({ target: { value } });
    },
    value(name) {
      return nodes(
        view(),
        (n) => n.type === "input" && n.props.name === name,
      )[0].props.value;
    },
    submit() {
      return one(view(), "form").props.onSubmit({ preventDefault() {} });
    },
    confirm() {
      return nodes(
        view(),
        (n) =>
          n.type === "button" &&
          ["Xác nhận ngắt kết nối", "Đang ngắt..."].includes(n.props.children),
      )[0].props.onClick();
    },
    count(method, reconnect = false) {
      return requests.filter(
        (r) =>
          r.method === method &&
          (method !== "POST" || r.path.endsWith("reconnect") === reconnect),
      ).length;
    },
    retryRead() {
      const b = nodes(
        view(),
        (n) => n.type === "button" && n.props.children === "Kiểm tra lại tên",
      )[0];
      assert.ok(b, "read-only retry available");
      return b.props.onClick();
    },
    submitDisabled() {
      return nodes(
        view(),
        (n) => n.type === "button" && n.props.type === "submit",
      )[0].props.disabled;
    },
  };
}

test("lifecycle callbacks execute create/delete payloads and refresh only after confirmed success", async () => {
  for (const action of ["create", "disconnect"])
    for (const rejected of [false, true]) {
      const r = lifecycleRig();
      r.state[action === "create" ? "connect" : "remove"] = rejected
        ? 403
        : "ok";
      await r.open(action);
      const before = r.live.writes;
      if (action === "create") {
        r.fill("displayName", "  New account  ");
        r.fill("loginIdentifier", "  synthetic  ");
        r.fill("password", " raw-password ");
        await r.submit();
        const write = r.requests.find((x) => x.method === "POST");
        assert.equal(write.path, "/api/carrier-connections");
        assert.deepEqual(JSON.parse(JSON.stringify(write.options.body)), {
          provider: "uniship",
          displayName: "New account",
          loginIdentifier: "synthetic",
          password: " raw-password ",
        });
      } else {
        await r.confirm();
        assert.equal(r.count("DELETE"), 1);
      }
      assert.equal(r.closes, rejected ? 0 : 1);
      assert.equal(
        r.live.writes > before,
        !rejected,
        "only a confirmed write triggers refresh",
      );
    }
});

test("edit callbacks distinguish rename-only, reconnect-only, ordered combined, rejection and unchanged drafts", async () => {
  for (const scenario of ["name", "password", "both", "rejected", "none"]) {
    const r = lifecycleRig();
    await r.open();
    if (["name", "both", "rejected"].includes(scenario))
      r.fill("displayName", "Requested");
    if (["password", "both", "rejected"].includes(scenario))
      r.fill("password", "synthetic-password");
    if (scenario === "rejected") r.state.reconnect = 400;
    await r.submit();
    const writes = r.requests.filter((x) => x.method !== "GET");
    assert.deepEqual(
      writes.map((x) => x.method),
      {
        name: ["PATCH"],
        password: ["POST"],
        both: ["POST", "PATCH"],
        rejected: ["POST"],
        none: [],
      }[scenario],
    );
    assert.equal(r.closes, ["none", "rejected"].includes(scenario) ? 0 : 1);
  }
});

test("confirmed reconnect plus rejected rename clears password and retry never reconnects twice", async () => {
  const r = lifecycleRig();
  await r.open();
  r.fill("displayName", "Requested");
  r.fill("password", "synthetic-password");
  r.state.rename = 400;
  await r.submit();
  assert.equal(
    r.value("password"),
    "",
    "confirmed reconnect password must be cleared",
  );
  assert.equal(r.value("displayName"), "Requested");
  assert.equal(r.closes, 0);
  assert.match(JSON.stringify(r.view()), /Mật khẩu.*đã được cập nhật/);
  assert.equal(r.count("POST", true), 1);
  assert.equal(r.count("PATCH"), 1);
  r.state.rename = "ok";
  await r.submit();
  assert.equal(r.count("POST", true), 1, "retry only renames");
  assert.equal(r.count("PATCH"), 2);
  assert.equal(r.closes, 1);
});

for (const outcome of [
  503,
  "network",
  "malformed",
  "malformed-nested",
  "commit-error",
])
  test(`unknown rename ${outcome} reconciles without auto retry`, async () => {
    const r = lifecycleRig();
    await r.open();
    r.fill("displayName", "Requested");
    r.fill("password", "synthetic-password");
    r.state.rename = outcome;
    const reads = r.count("GET");
    await r.submit();
    assert.equal(r.value("password"), "");
    assert.equal(r.closes, 0);
    assert.ok(r.count("GET") > reads, "authoritative connection read required");
    assert.equal(r.count("POST", true), 1);
    assert.equal(r.count("PATCH"), 1);
    if (outcome === "commit-error") {
      assert.equal(r.submitDisabled(), true);
      await r.submit();
      assert.equal(r.count("PATCH"), 1);
    } else {
      r.state.rename = "ok";
      await r.submit();
      assert.equal(r.count("PATCH"), 2);
      assert.equal(r.count("POST", true), 1);
    }
  });

test("failed reconciliation blocks writes and GET-only recovery uses fresh selected row baseline", async () => {
  const r = lifecycleRig();
  await r.open();
  r.fill("displayName", "Requested");
  r.fill("password", "synthetic-password");
  r.state.rename = 503;
  r.state.readFailure = true;
  await r.submit();
  assert.equal(r.value("password"), "");
  assert.equal(r.submitDisabled(), true);
  await r.submit();
  assert.equal(r.count("POST", true), 1);
  assert.equal(r.count("PATCH"), 1);
  r.state.readFailure = false;
  r.state.name = "Concurrent name";
  await r.retryRead();
  assert.equal(r.count("PATCH"), 1);
  assert.equal(r.submitDisabled(), false);
  r.fill("displayName", "Original");
  r.state.rename = "ok";
  await r.submit();
  assert.equal(
    r.count("PATCH"),
    2,
    "fresh baseline must allow restoring original name",
  );
  assert.equal(r.count("POST", true), 1);
});

test("partial recovery permits a deliberately entered new password and preserves session401 boundary", async () => {
  for (const expired of [false, true]) {
    const r = lifecycleRig();
    await r.open();
    r.fill("displayName", "Requested");
    r.fill("password", "first-synthetic");
    r.state.rename = expired ? 401 : 400;
    const reads = r.count("GET");
    await r.submit();
    if (expired)
      assert.equal(
        r.count("GET"),
        reads,
        "no reconciliation after session denial (confirmed refresh remains independent)",
      );
    assert.equal(r.value("password"), "");
    if (expired) {
      assert.match(JSON.stringify(r.view()), /Phiên đăng nhập/);
    } else {
      r.state.rename = "ok";
      r.fill("password", "second-synthetic");
      await r.submit();
      assert.equal(r.count("POST", true), 2);
    }
  }
});

test("lifecycle forms and disconnect synchronously fence double-submit callbacks", async () => {
  for (const action of ["create", "edit", "disconnect"]) {
    const r = lifecycleRig();
    await r.open(action);
    if (action !== "disconnect") {
      r.fill("password", "synthetic-password");
      if (action === "create") {
        r.fill("displayName", "New");
        r.fill("loginIdentifier", "synthetic");
      }
    }
    let release;
    r.state.writeWait = new Promise((resolve) => {
      release = resolve;
    });
    const first = action === "disconnect" ? r.confirm() : r.submit();
    const second = action === "disconnect" ? r.confirm() : r.submit();
    await second;
    assert.equal(r.requests.filter((x) => x.method !== "GET").length, 1);
    release();
    await first;
    assert.equal(r.closes, 1);
  }
});

test("unmounted reconciliation aborts and ignores delayed authoritative read", async () => {
  const r = lifecycleRig();
  await r.open();
  r.fill("displayName", "Requested");
  r.fill("password", "synthetic-password");
  r.state.rename = 503;
  let release;
  r.state.readWait = new Promise((resolve) => {
    release = resolve;
  });
  const submission = r.submit();
  await tickLifecycle();
  const read = r.requests.filter((x) => x.method === "GET").at(-1);
  assert.equal(read.path, "/api/carrier-connections");
  assert.equal(r.value("password"), "", "clear before read completes");
  r.drawer.unmount();
  r.live.unmount();
  const writes = r.drawer.writes;
  assert.equal(read.options.signal.aborted, true);
  release();
  await submission;
  assert.equal(r.drawer.writes, writes, "stale read cannot write drawer state");
  assert.equal(r.count("POST", true), 1);
  assert.equal(r.count("PATCH"), 1);
});

test("callback-less drawer submit remains a draft without any write or close", async () => {
  const r = lifecycleRig();
  let closes = 0;
  const props = {
    onClose() {
      closes++;
    },
  };
  const view = r.drawer.render(props);
  const button = nodes(
    view,
    (n) => n.type === "button" && n.props.type === "submit",
  )[0];
  assert.equal(button.props.disabled, true);
  await one(view, "form").props.onSubmit({ preventDefault() {} });
  assert.equal(r.requests.length, 0);
  assert.equal(closes, 0);
});

test("malformed reconnect success never counts as confirmed or proceeds to Rename", async () => {
  const r = lifecycleRig();
  await r.open();
  r.fill("displayName", "Requested");
  r.fill("password", "synthetic-password");
  r.state.reconnect = "malformed-nested";
  await r.submit();
  assert.equal(
    r.count("PATCH"),
    0,
    "unconfirmed reconnect cannot admit Rename",
  );
  assert.equal(r.closes, 0);
  assert.equal(
    r.value("password"),
    "synthetic-password",
    "do not falsely report a confirmed reconnect",
  );
  assert.doesNotMatch(
    JSON.stringify(r.view()),
    /Mật khẩu kết nối đã được cập nhật/,
  );
});
