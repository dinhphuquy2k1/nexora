import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
import { FIXTURE_DETAILS, asSummary } from "./fixtures/retail-packages.ts";
function loaded(name, state) {
  const cache = new Map([
    [
      fileURLToPath(
        new URL(
          "../features/retail-packages/useShipmentRead.ts",
          import.meta.url,
        ),
      ),
      {
        exports: {
          useShipmentList: () => ({ stats: state.data?.stats, ...state }),
          useShipmentDetail: () => state,
        },
      },
    ],
  ]);
  return loadComponent(
    new URL("../features/retail-packages/" + name + ".tsx", import.meta.url),
    cache,
  );
}
const data = {
  shipments: FIXTURE_DETAILS.slice(0, 2).map((d, i) => ({
    ...asSummary(d),
    ...(i === 0 ? { logisticsStage: "UNKNOWN" } : {}),
  })),
  pagination: { page: 1, pageSize: 10, total: 30, totalPages: 3 },
  stats: {
    total: 30,
    byStage: {
      TO_ORIGIN_WAREHOUSE: 5,
      AT_ORIGIN_WAREHOUSE: 5,
      TO_DEST_WAREHOUSE: 5,
      AT_DEST_WAREHOUSE: 5,
      DELIVERED: 5,
      UNKNOWN: 5,
    },
    claims: null,
  },
  claimFilterAvailable: false,
};
test("Retail page uses authoritative rows/counts and only allowed disabled/UNKNOWN changes", () => {
  const { RetailPackageListPage } = loaded("RetailPackageListPage", {
    data,
    status: "ready",
    loading: false,
    refresh() {},
  });
  const html = render(
    React.createElement(RetailPackageListPage, {
      api: {},
      initialSearch: "?page=1&pageSize=10",
    }),
  );
  assert.match(html, /30 kiện lẻ/);
  assert.match(html, /5 kiện có trạng thái chưa xác định từ hãng/);
  assert.match(html, /Nhiều dòng/);
  assert.match(
    html,
    /<button[^>]*disabled[^>]*title="Chưa hỗ trợ"[^>]*aria-label="Tạo kiện lẻ mới"|<button[^>]*disabled[^>]*aria-label="Tạo kiện lẻ mới"[^>]*title="Chưa hỗ trợ"/,
  );
  assert.match(html, /Chưa xác định/);
  assert.doesNotMatch(html, /Tài khoản chính|Shipment API chưa khả dụng/);
  assert.equal((html.match(/<col /g) || []).length, 19);
  assert.match(
    html.match(/<button[^>]*id="retail-tab-disputed"[^>]*>/)[0],
    /title="Chưa hỗ trợ"/,
  );
});
test("Retail loading/error/empty states remain inside the existing table layout", () => {
  for (const [state, text] of [
    [{ status: "loading", loading: true }, "Đang tải"],
    [
      {
        status: "error",
        loading: false,
        error: { message: "Không thể tải dữ liệu kiện hàng." },
      },
      "Thử lại",
    ],
    [
      {
        status: "ready",
        loading: false,
        data: {
          ...data,
          shipments: [],
          pagination: { ...data.pagination, total: 0, totalPages: 0 },
        },
      },
      "Chưa có kiện nào được đồng bộ.",
    ],
  ]) {
    const { RetailPackageListPage } = loaded("RetailPackageListPage", {
      ...state,
      refresh() {},
    });
    const html = render(
      React.createElement(RetailPackageListPage, { api: {} }),
    );
    assert.ok(html.includes(text), text);
    assert.equal((html.match(/<col /g) || []).length, 19);
  }
});
test("Retail drawer reads exact item price, fee lines and observed history without fictitious steps", () => {
  const { PackageDetailDrawer } = loaded("PackageDetailDrawer", {
    status: "ready",
    loading: false,
    data: {
      shipment: FIXTURE_DETAILS[0],
      history: {
        history: [
          {
            id: "h",
            toStage: "UNKNOWN",
            observedAt: "2026-11-14T00:00:00Z",
            providerChangedAt: "2026-11-13T23:59:00Z",
          },
        ],
      },
    },
    refresh() {},
  });
  const html = render(
    React.createElement(PackageDetailDrawer, {
      id: FIXTURE_DETAILS[0].id,
      api: {},
      onClose() {},
    }),
  );
  assert.match(html, /¥1,234,567,890,123,456.78/);
  assert.match(html, /Hãng ghi nhận:/);
  assert.match(html, /Nhập kho gửi/);
  assert.match(html, /Sản phẩm bổ sung/);
  assert.doesNotMatch(html, /Dự kiến 1[345]\/10|Người bán phát hàng/);
});
test("Retail drawer never renders '— kg' when weight is null", () => {
  const { PackageDetailDrawer } = loaded("PackageDetailDrawer", {
    status: "ready",
    loading: false,
    data: {
      shipment: FIXTURE_DETAILS[1],
      history: { history: [] },
    },
    refresh() {},
  });
  const html = render(
    React.createElement(PackageDetailDrawer, {
      id: FIXTURE_DETAILS[1].id,
      api: {},
      onClose() {},
    }),
  );
  assert.doesNotMatch(html, /—\s*kg/);
});
test("Retail list mobile card never renders '— kg' when weight is null", () => {
  const { RetailPackageListPage } = loaded("RetailPackageListPage", {
    data,
    status: "ready",
    loading: false,
    refresh() {},
  });
  const html = render(
    React.createElement(RetailPackageListPage, {
      api: {},
      initialSearch: "?page=1&pageSize=10",
    }),
  );
  assert.doesNotMatch(html, /—\s*kg/);
});

test("Retail loading uses five semantic visible-column skeleton rows and mobile cards", () => {
  const { RetailPackageListPage } = loaded("RetailPackageListPage", {
    status: "loading",
    loading: true,
    refresh() {},
  });
  const html = render(React.createElement(RetailPackageListPage, { api: {} }));
  assert.equal((html.match(/<tr[^>]*data-skeleton="true"/g) || []).length, 5);
  assert.equal((html.match(/data-skeleton-card="true"/g) || []).length, 5);
  assert.match(html, /<table[^>]*aria-busy="true"/);
  assert.match(html, /<span role="status" class="[^"]*srOnly/);
  assert.doesNotMatch(html, /<p[^>]*>Đang tải danh sách kiện lẻ/);
  assert.doesNotMatch(html, /<td[^>]*>Đang tải/);
  const rows = html.match(/<tr[^>]*data-skeleton="true"[\s\S]*?<\/tr>/g);
  for (const row of rows) {
    assert.match(row, /aria-hidden="true"/);
    assert.equal((row.match(/<td/g) || []).length, 19);
    assert.doesNotMatch(row, /data-column="carrier"/);
  }
  assert.equal((html.match(/<th /g) || []).length, 19);
});

test("Retail skeleton follows arbitrary visible-column order; retained rows remain pending", () => {
  const { RetailPackageTable } = loaded("RetailPackageTable", {});
  const columns = [
    { id: "trackingCode", label: "MÃ VẬN ĐƠN", width: 150 },
    { id: "status", label: "TRẠNG THÁI", width: 150 },
  ];
  const props = {
    visibleColumns: columns,
    onDetail() {},
    unavailable: true,
    loading: true,
  };
  const html = render(
    React.createElement(RetailPackageTable, { ...props, paginated: [] }),
  );
  assert.equal((html.match(/<td /g) || []).length, 10);
  assert.equal((html.match(/<col /g) || []).length, 2);
  const { RetailPackageListPage } = loaded("RetailPackageListPage", {
    data,
    status: "loading",
    loading: true,
    refresh() {},
  });
  const retained = render(
    React.createElement(RetailPackageListPage, { api: {} }),
  );
  assert.doesNotMatch(retained, /data-skeleton="true"/);
  assert.match(retained, /data-stale="true"/);
  assert.match(retained, /data-package-id=/);
});
