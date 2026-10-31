/**
 * Retail Packages feature — tests.
 *
 * Tests verify:
 * 1. Column configuration (required columns, visibility defaults)
 * 2. Status tab definitions match RetailPackageStatus type
 * 3. Synthetic fixtures are structurally valid
 * 4. Route path contract (canonical path and legacy redirect path)
 * 5. Navigation config: shipment item is now "available" pointing to /shipments/retail
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RETAIL_PACKAGE_COLUMNS,
  STATUS_TABS,
  DEFAULT_COLUMN_VISIBILITY,
  PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
} from "../features/retail-packages/columns.ts";
import { SYNTHETIC_PACKAGES } from "./fixtures/retail-packages.ts";
import { NAVIGATION_ITEMS } from "../lib/navigation/nav-config.ts";
import { loadComponent, React, render } from "./helpers/render-component.mjs";

describe("Retail Packages — column configuration", () => {
  it("has at least one required column", () => {
    const required = RETAIL_PACKAGE_COLUMNS.filter((c) => c.required);
    assert.ok(required.length >= 1, "At least one required column expected");
  });

  it("trackingCode column is required", () => {
    const col = RETAIL_PACKAGE_COLUMNS.find((c) => c.id === "trackingCode");
    assert.ok(col, "trackingCode column must exist");
    assert.strictEqual(col.required, true, "trackingCode must be required");
  });

  it("DEFAULT_COLUMN_VISIBILITY matches column definitions", () => {
    for (const col of RETAIL_PACKAGE_COLUMNS) {
      assert.ok(
        col.id in DEFAULT_COLUMN_VISIBILITY,
        `Column ${col.id} should have a default visibility`,
      );
      assert.strictEqual(
        DEFAULT_COLUMN_VISIBILITY[col.id],
        col.defaultVisible,
        `Default visibility mismatch for ${col.id}`,
      );
    }
  });

  it("has 20 columns (matching reference ZIP)", () => {
    assert.strictEqual(RETAIL_PACKAGE_COLUMNS.length, 20);
  });

  it("PAGE_SIZE is 10", () => {
    assert.strictEqual(PAGE_SIZE, 10);
  });

  it("PAGE_SIZE_OPTIONS includes 5, 10, 20, 50, 100", () => {
    assert.deepStrictEqual(PAGE_SIZE_OPTIONS, [5, 10, 20, 50, 100]);
  });
});

describe("Retail Packages — status tabs", () => {
  it("has 7 status tabs (all + 6 statuses)", () => {
    assert.strictEqual(STATUS_TABS.length, 7);
  });

  it("first tab is 'all'", () => {
    const firstTab = STATUS_TABS[0];
    assert.ok(firstTab, "STATUS_TABS must have at least one entry");
    assert.strictEqual(firstTab.key, "all");
  });

  it("includes all expected status keys", () => {
    const keys = STATUS_TABS.map((t) => t.key);
    const expected = [
      "all",
      "to_origin",
      "at_origin",
      "in_transit",
      "at_dest",
      "delivered",
      "disputed",
    ];
    for (const k of expected) {
      assert.ok(keys.includes(k), `Status tab '${k}' must be present`);
    }
  });
});

describe("Retail Packages — synthetic fixtures", () => {
  it("has 6 synthetic test packages", () => {
    assert.strictEqual(SYNTHETIC_PACKAGES.length, 6);
  });

  it("each package has required string fields", () => {
    for (const pkg of SYNTHETIC_PACKAGES) {
      assert.ok(
        typeof pkg.id === "string" && pkg.id.length > 0,
        `pkg.id must be non-empty string`,
      );
      assert.ok(
        typeof pkg.trackingCode === "string" && pkg.trackingCode.length > 0,
        `pkg.trackingCode must be non-empty`,
      );
      assert.ok(
        typeof pkg.productName === "string" && pkg.productName.length > 0,
        `pkg.productName must be non-empty`,
      );
      assert.ok(
        typeof pkg.status === "string" && pkg.status.length > 0,
        `pkg.status must be non-empty`,
      );
    }
  });

  it("each package has valid numeric fields", () => {
    for (const pkg of SYNTHETIC_PACKAGES) {
      assert.ok(
        typeof pkg.weightKg === "number" && pkg.weightKg > 0,
        `pkg.weightKg must be positive`,
      );
      assert.ok(
        typeof pkg.totalAmountVND === "number" && pkg.totalAmountVND > 0,
        `pkg.totalAmountVND must be positive`,
      );
      assert.ok(
        typeof pkg.valueCNY === "number" && pkg.valueCNY > 0,
        `pkg.valueCNY must be positive`,
      );
    }
  });

  it("each package has a non-empty timeline", () => {
    for (const pkg of SYNTHETIC_PACKAGES) {
      assert.ok(
        Array.isArray(pkg.timeline) && pkg.timeline.length > 0,
        `pkg ${pkg.id} must have at least one timeline step`,
      );
    }
  });

  it("each package has a unique id", () => {
    const ids = SYNTHETIC_PACKAGES.map((p) => p.id);
    const unique = new Set(ids);
    assert.strictEqual(
      unique.size,
      ids.length,
      "All package IDs must be unique",
    );
  });

  it("each package has a unique trackingCode", () => {
    const codes = SYNTHETIC_PACKAGES.map((p) => p.trackingCode);
    const unique = new Set(codes);
    assert.strictEqual(
      unique.size,
      codes.length,
      "All tracking codes must be unique",
    );
  });
});

describe("Retail Packages — navigation contract", () => {
  it("shipment nav item is now 'available'", () => {
    const item = NAVIGATION_ITEMS.find((n) => n.id === "shipment");
    assert.ok(item, "shipment nav item must exist");
    assert.strictEqual(
      item.status,
      "available",
      "shipment must be status='available'",
    );
  });

  it("shipment nav item points to /shipments/retail", () => {
    const item = NAVIGATION_ITEMS.find((n) => n.id === "shipment");
    assert.ok(item, "shipment nav item must exist");
    assert.strictEqual(item.href, "/shipments/retail");
  });

  it("shipment nav item has contentVariant='wide'", () => {
    const item = NAVIGATION_ITEMS.find((n) => n.id === "shipment");
    assert.ok(item, "shipment nav item must exist");
    assert.strictEqual(item.contentVariant, "wide");
  });
});

describe("Retail Packages — legacy redirect and server route", () => {
  it("legacy redirect route exports GET handler returning 307", async () => {
    const route = await import("../app/logistics/parcels/route.ts");
    assert.strictEqual(typeof route.GET, "function", "route must export GET");

    const req = {
      nextUrl: new URL(
        "http://localhost:3000/logistics/parcels?status=to_origin",
      ),
      url: "http://localhost:3000/logistics/parcels?status=to_origin",
    };
    const res = route.GET(req);
    assert.strictEqual(res.status, 307);
    assert.match(
      res.headers.get("location") ?? "",
      /\/shipments\/retail\?status=to_origin/,
    );
  });

  it("server page at /shipments/retail imports RetailPackageListPage with empty initialPackages", async () => {
    const fs = await import("node:fs/promises");
    const pageContent = await fs.readFile(
      new URL("../app/(workspace)/shipments/retail/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(
      pageContent,
      /initialPackages=\{\[\]\}/,
      "Production page must pass empty initialPackages array",
    );
  });
});

describe("Retail Packages — components and truthfulness", () => {
  it("CreatePackageDrawer exports valid React component", () => {
    const mod = loadComponent(
      new URL(
        "../features/retail-packages/CreatePackageDrawer.tsx",
        import.meta.url,
      ),
    );
    assert.strictEqual(typeof mod.CreatePackageDrawer, "function");
  });

  it("PackageDetailDrawer exports valid React component", () => {
    const mod = loadComponent(
      new URL(
        "../features/retail-packages/PackageDetailDrawer.tsx",
        import.meta.url,
      ),
    );
    assert.strictEqual(typeof mod.PackageDetailDrawer, "function");
  });

  it("PackageFeeSection exports valid React component", () => {
    const mod = loadComponent(
      new URL(
        "../features/retail-packages/PackageFeeSection.tsx",
        import.meta.url,
      ),
    );
    assert.strictEqual(typeof mod.PackageFeeSection, "function");
  });
});

it("production availability cannot become fake data, while available-empty preserves the list chrome", () => {
  const { RetailPackageListPage } = loadComponent(
    new URL(
      "../features/retail-packages/RetailPackageListPage.tsx",
      import.meta.url,
    ),
  );
  const unavailable = render(
    React.createElement(RetailPackageListPage, {
      initialPackages: SYNTHETIC_PACKAGES,
      availability: "unavailable",
    }),
  );
  assert.match(unavailable, /Shipment API chưa khả dụng/);
  assert.doesNotMatch(unavailable, /data-package-id/);
  assert.equal((unavailable.match(/role="tab"/g) || []).length, 7);
  assert.equal((unavailable.match(/<col(?=[\s/>])/g) || []).length, 19);
  assert.doesNotMatch(unavailable, /NEXORA Linehaul|1900 8829/);
  // Default count badge presentation when unavailable displays em-dash with honest tooltip and sr-only label
  assert.match(
    unavailable,
    /title="Chưa có dữ liệu"/,
    "Unavailable badges present honest title label",
  );
  assert.match(
    unavailable,
    /aria-hidden="true">—<\/span>/,
    "Unavailable badges display em-dash",
  );
  assert.match(
    unavailable,
    /chưa có dữ liệu<\/span>/,
    "Unavailable badges include screen reader text",
  );
  assert.match(
    unavailable,
    /var\(--color-retail-tab-all-icon\)/,
    "Status tabs configure semantic activeIconColor tokens",
  );
  const empty = render(
    React.createElement(RetailPackageListPage, {
      initialPackages: [],
      availability: "available",
    }),
  );
  assert.doesNotMatch(empty, /Shipment API chưa khả dụng\. Chưa/);
  assert.match(empty, /data-retail-count[^>]*>0(?:<!-- -->)? kiện lẻ/);
  assert.equal((empty.match(/role="tab"/g) || []).length, 7);
});
it("Create uses one native dialog and no verified-looking carrier or rate; absent quote stays unavailable", () => {
  const { CreatePackageDrawer } = loadComponent(
    new URL(
      "../features/retail-packages/CreatePackageDrawer.tsx",
      import.meta.url,
    ),
  );
  const html = render(
    React.createElement(CreatePackageDrawer, { onClose() {} }),
  );
  assert.equal((html.match(/<dialog/g) || []).length, 1);
  assert.doesNotMatch(html, /role="dialog"|NEXORA Linehaul|SLA:|3%/);
  assert.match(html, /Chưa có dữ liệu hãng vận chuyển/);
  const { PackageFeeSection } = loadComponent(
    new URL(
      "../features/retail-packages/PackageFeeSection.tsx",
      import.meta.url,
    ),
  );
  for (const value of [undefined, NaN, Infinity, -1])
    assert.match(
      render(
        React.createElement(PackageFeeSection, {
          totalAmountVND: value,
          weightKg: 10,
        }),
      ),
      /Chưa có báo giá/,
    );
  assert.doesNotMatch(
    render(React.createElement(PackageFeeSection, { totalAmountVND: 0 })),
    /Chưa có báo giá/,
  );
});

it("desktop and mobile distinguish unavailable data from an available empty result", () => {
  const { RetailPackageTable } = loadComponent(
    new URL(
      "../features/retail-packages/RetailPackageTable.tsx",
      import.meta.url,
    ),
  );
  for (const unavailable of [true, false]) {
    const html = render(
      React.createElement(RetailPackageTable, {
        paginated: [],
        visibleColumns: RETAIL_PACKAGE_COLUMNS,
        onDetail: () => {},
        unavailable,
      }),
    );
    const message = unavailable
      ? "Dữ liệu kiện lẻ chưa khả dụng từ máy chủ."
      : "Không tìm thấy kiện lẻ phù hợp với bộ lọc.";
    assert.equal(html.split(message).length - 1, 2);
    if (unavailable) assert.doesNotMatch(html, /Không tìm thấy kiện/);
  }
});

describe("Retail Packages — Visual Parity (M3 v4)", () => {
  it("Reload button renders RefreshCw icon with label 'Làm mới' even when disabled", () => {
    const { RetailPackageListPage } = loadComponent(
      new URL(
        "../features/retail-packages/RetailPackageListPage.tsx",
        import.meta.url,
      ),
    );
    const html = render(
      React.createElement(RetailPackageListPage, {
        initialPackages: [],
        availability: "unavailable",
      }),
    );
    assert.match(
      html,
      /<button[^>]*disabled[^>]*aria-label="Làm mới dữ liệu \(chưa khả dụng\)"|<button[^>]*aria-label="Làm mới dữ liệu \(chưa khả dụng\)"[^>]*disabled/,
      "Reload button is disabled when unavailable",
    );
    assert.match(
      html,
      /<span>Làm mới<\/span>/,
      "Reload button presents 'Làm mới' text label",
    );
  });

  it("Filter button renders 'Thêm điều kiện lọc' label with 'Bộ lọc nâng cao' aria-label", () => {
    const { RetailFilterPopover } = loadComponent(
      new URL(
        "../features/retail-packages/RetailFilterPopover.tsx",
        import.meta.url,
      ),
    );
    const html = render(
      React.createElement(RetailFilterPopover, {
        filters: [],
        onAdd: () => {},
      }),
    );
    assert.match(html, /aria-label="Bộ lọc nâng cao"/);
    assert.match(html, /Thêm điều kiện lọc/);
  });

  it("Column Picker reflects three visual states (filtered, full, open)", () => {
    const { RetailColumnPicker } = loadComponent(
      new URL(
        "../features/retail-packages/RetailColumnPicker.tsx",
        import.meta.url,
      ),
    );
    // Filtered state (19/20 columns)
    const filteredHtml = render(
      React.createElement(RetailColumnPicker, {
        visibility: DEFAULT_COLUMN_VISIBILITY,
        onChange: () => {},
      }),
    );
    assert.match(filteredHtml, /colPickerTrigger_filtered/);
    assert.match(filteredHtml, /colPickerBadge_filtered/);
    assert.match(filteredHtml, /19\/20/);

    // Full state (20/20 columns)
    const allVisible = Object.fromEntries(
      RETAIL_PACKAGE_COLUMNS.map((c) => [c.id, true]),
    );
    const fullHtml = render(
      React.createElement(RetailColumnPicker, {
        visibility: allVisible,
        onChange: () => {},
      }),
    );
    assert.match(fullHtml, /colPickerTrigger_full/);
    assert.match(fullHtml, /colPickerBadge_full/);
    assert.match(fullHtml, /20\/20/);
  });

  it("Pagination renders range calculation and inline page size wrapper", () => {
    const { RetailPagination } = loadComponent(
      new URL(
        "../features/retail-packages/RetailPagination.tsx",
        import.meta.url,
      ),
    );
    // 6 items on page 1 with pageSize 10
    const fixtureHtml = render(
      React.createElement(RetailPagination, {
        page: 1,
        pageSize: 10,
        total: 6,
        unavailable: false,
        onPage: () => {},
        onSize: () => {},
      }),
    );
    assert.match(fixtureHtml, /paginationRange[^>]*>1–6<\/strong>/);
    assert.match(fixtureHtml, /data-retail-count[^>]*>6(?:<!-- -->)? kiện lẻ/);
    assert.match(fixtureHtml, /pageSizeSelectWrapper/);
    assert.match(fixtureHtml, /Số dòng:/);

    // 0 items
    const zeroHtml = render(
      React.createElement(RetailPagination, {
        page: 1,
        pageSize: 10,
        total: 0,
        unavailable: false,
        onPage: () => {},
        onSize: () => {},
      }),
    );
    assert.match(zeroHtml, /paginationRange[^>]*>0–0<\/strong>/);
    assert.match(zeroHtml, /data-retail-count[^>]*>0(?:<!-- -->)? kiện lẻ/);

    // Unavailable
    const unavailHtml = render(
      React.createElement(RetailPagination, {
        page: 1,
        pageSize: 10,
        total: 0,
        unavailable: true,
        onPage: () => {},
        onSize: () => {},
      }),
    );
    assert.match(unavailHtml, /paginationRange[^>]*>—<\/strong>/);
    assert.match(unavailHtml, /data-retail-count[^>]*>—(?:<!-- -->)? kiện lẻ/);
  });

  describe("Retail Packages — Visual Parity & Architecture (M3 v5)", () => {
    it("RetailPackageTable enforces full width (width: 100%) with minimum width bounds", () => {
      const { RetailPackageTable } = loadComponent(
        new URL(
          "../features/retail-packages/RetailPackageTable.tsx",
          import.meta.url,
        ),
      );
      const { columnPreset, visibleColumns } = loadComponent(
        new URL("../features/retail-packages/columns.ts", import.meta.url),
      );

      // Basic preset (7 columns)
      const basicVisibility = columnPreset("basic");
      const basicCols = visibleColumns(basicVisibility);
      const minBasicWidth = basicCols.reduce((n, c) => n + c.width, 0);

      const html = render(
        React.createElement(RetailPackageTable, {
          paginated: [],
          visibleColumns: basicCols,
          unavailable: false,
          onDetail: () => {},
        }),
      );

      assert.match(html, /width:\s*100%/i, "table must have width: 100%");
      assert.match(
        html,
        new RegExp(`min-width:\\s*${minBasicWidth}px`, "i"),
        `table must have min-width: ${minBasicWidth}px`,
      );
    });

    it("RetailColumnPicker closed trigger button renders aria-haspopup and count badge", () => {
      const { RetailColumnPicker } = loadComponent(
        new URL(
          "../features/retail-packages/RetailColumnPicker.tsx",
          import.meta.url,
        ),
      );
      const { DEFAULT_COLUMN_VISIBILITY } = loadComponent(
        new URL("../features/retail-packages/columns.ts", import.meta.url),
      );

      const triggerHtml = render(
        React.createElement(RetailColumnPicker, {
          visibility: DEFAULT_COLUMN_VISIBILITY,
          onChange: () => {},
        }),
      );
      assert.match(triggerHtml, /Tùy chỉnh cột hiển thị/);
      assert.match(triggerHtml, /aria-haspopup="dialog"/);
      assert.match(triggerHtml, /aria-expanded="false"/);
      assert.match(triggerHtml, /colPickerTriggerLabel/);
      assert.match(triggerHtml, /Cột hiển thị/);
      assert.match(triggerHtml, /19\/20/);
    });

    it("RetailColumnPicker open popover renders header, SelectButton presets, pinned badge, and 'Đã xong' button", () => {
      const { RetailColumnPicker } = loadComponent(
        new URL(
          "../features/retail-packages/RetailColumnPicker.tsx",
          import.meta.url,
        ),
      );
      const { DEFAULT_COLUMN_VISIBILITY } = loadComponent(
        new URL("../features/retail-packages/columns.ts", import.meta.url),
      );

      const popoverHtml = render(
        React.createElement(RetailColumnPicker, {
          visibility: DEFAULT_COLUMN_VISIBILITY,
          onChange: () => {},
          defaultOpen: true,
        }),
      );

      // Dialog container
      assert.match(popoverHtml, /role="dialog"/);
      assert.match(popoverHtml, /aria-label="Tùy chỉnh cột hiển thị"/);

      // Header title and close button
      assert.match(popoverHtml, /Tùy chỉnh cột hiển thị/);
      assert.match(popoverHtml, /aria-label="Đóng tùy chỉnh cột"/);

      // Presets SelectButton with text-actions appearance
      assert.match(popoverHtml, /aria-label="Chọn cấu hình cột"/);
      assert.match(popoverHtml, /textActions/);
      assert.match(popoverHtml, /textActionsSeparator/);
      assert.match(popoverHtml, /Tất cả/);
      assert.match(popoverHtml, /Cơ bản/);
      assert.match(popoverHtml, /Mặc định/);

      // Column search wrapper and checkboxes
      assert.match(popoverHtml, /colPickerSearchWrapper/);
      assert.match(popoverHtml, /aria-label="Tìm tên cột"/);
      assert.match(popoverHtml, /aria-label="Danh sách cột hiển thị"/);

      // Pinned badge for required column
      assert.match(popoverHtml, /Cố định/);

      // Footer counter and "Đã xong" button
      assert.match(popoverHtml, /Đang bật: <strong>19<\/strong>\/20 cột/);
      assert.match(popoverHtml, /Đã xong/);
    });

    it("RetailColumnPicker preset configurations and column visibility transitions", () => {
      const { columnPreset, visibleColumns } = loadComponent(
        new URL("../features/retail-packages/columns.ts", import.meta.url),
      );

      // 1. Basic preset
      const basic = columnPreset("basic");
      const basicCols = visibleColumns(basic);
      assert.strictEqual(basicCols.length, 7);
      assert.ok(
        basicCols.some((c) => c.id === "trackingCode"),
        "trackingCode must be in basic preset",
      );

      // 2. Default preset
      const def = columnPreset("default");
      const defCols = visibleColumns(def);
      assert.strictEqual(defCols.length, 19);

      // 3. All preset
      const all = columnPreset("all");
      const allCols = visibleColumns(all);
      assert.strictEqual(allCols.length, 20);

      // 4. Custom selection does not match any preset
      const custom = { ...basic, productName: false };
      const customIds = visibleColumns(custom)
        .map((c) => c.id)
        .join(",");
      for (const p of ["all", "basic", "default"]) {
        const pIds = visibleColumns(columnPreset(p))
          .map((c) => c.id)
          .join(",");
        assert.notStrictEqual(
          customIds,
          pIds,
          `Custom selection must not match preset ${p}`,
        );
      }
    });

    it("RetailPackageListPage unavailable state renders em-dash count and honest accessible label", () => {
      const { RetailPackageListPage } = loadComponent(
        new URL(
          "../features/retail-packages/RetailPackageListPage.tsx",
          import.meta.url,
        ),
      );

      const html = render(
        React.createElement(RetailPackageListPage, {
          initialPackages: [],
          availability: "unavailable",
        }),
      );

      // Must render em-dash for count, not 0
      assert.match(
        html,
        /aria-hidden="true">—<\/span>/,
        "Unavailable count must render visual em-dash with aria-hidden",
      );
      assert.match(
        html,
        /title="Chưa có dữ liệu"/,
        "Unavailable count must have honest title attribute",
      );
      assert.match(
        html,
        /chưa có dữ liệu<\/span>/,
        "Unavailable count must have screen reader text 'chưa có dữ liệu'",
      );
      assert.ok(
        !html.includes("tạm tính: 0"),
        "Must not claim unavailable count is 0",
      );
    });

    it("matchesFilter enforces exact numeric equality semantics", () => {
      const { matchesFilter } = loadComponent(
        new URL("../features/retail-packages/filters.ts", import.meta.url),
      );

      const basePkg = {
        id: "pkg-1",
        trackingCode: "VN123456",
        productName: "Áo thun",
        carrierName: "ZTO Express",
        status: "to_origin",
        unitPriceCNY: 100,
        weightKg: 2.5,
        originWarehouseName: "Kho TMĐT Quảng Châu",
      };

      // Exact match on integer/decimal
      assert.ok(
        matchesFilter(basePkg, {
          field: "unitPriceCNY",
          operator: "equals",
          value: "100",
        }),
        "Exact 100 must match",
      );
      assert.ok(
        matchesFilter(basePkg, {
          field: "weightKg",
          operator: "equals",
          value: "2.5",
        }),
        "Exact 2.5 must match",
      );

      // Inexact values within 0.01 tolerance must NOT match under exact equality
      const nearPricePkg = { ...basePkg, unitPriceCNY: 100.005 };
      assert.ok(
        !matchesFilter(nearPricePkg, {
          field: "unitPriceCNY",
          operator: "equals",
          value: "100",
        }),
        "100.005 must NOT match 100 under exact equality",
      );

      const nearWeightPkg = { ...basePkg, weightKg: 2.508 };
      assert.ok(
        !matchesFilter(nearWeightPkg, {
          field: "weightKg",
          operator: "equals",
          value: "2.5",
        }),
        "2.508 must NOT match 2.5 under exact equality",
      );
    });

    it("matchesFilter enforces canonical warehouse normalization and exact equality", () => {
      const { matchesFilter, normalizeWarehouse } = loadComponent(
        new URL("../features/retail-packages/filters.ts", import.meta.url),
      );

      // Normalization helper tests
      assert.strictEqual(
        normalizeWarehouse("Kho TMĐT Quảng Châu (3-4 ngày-Không VAT)"),
        "Quảng Châu",
      );
      assert.strictEqual(
        normalizeWarehouse("Kho Bằng Tường (2-3 ngày)"),
        "Bằng Tường",
      );
      assert.strictEqual(
        normalizeWarehouse("Kho Đông Hưng (2-3 ngày)"),
        "Đông Hưng",
      );
      assert.strictEqual(normalizeWarehouse("Quảng Châu"), "Quảng Châu");

      // Package filtering tests
      const qcPkg = {
        id: "pkg-qc",
        trackingCode: "VN111",
        productName: "Giày",
        carrierName: "YTO",
        status: "to_origin",
        originWarehouseName: "Kho TMĐT Quảng Châu (3-4 ngày-Không VAT)",
      };
      const btPkg = {
        id: "pkg-bt",
        trackingCode: "VN222",
        productName: "Túi",
        carrierName: "SF",
        status: "at_origin",
        originWarehouseName: "Kho Bằng Tường (2-3 ngày)",
      };

      assert.ok(
        matchesFilter(qcPkg, {
          field: "originWarehouse",
          operator: "equals",
          value: "Quảng Châu",
        }),
        "Quảng Châu package matches Quảng Châu filter",
      );
      assert.ok(
        !matchesFilter(qcPkg, {
          field: "originWarehouse",
          operator: "equals",
          value: "Bằng Tường",
        }),
        "Quảng Châu package does NOT match Bằng Tường filter",
      );

      assert.ok(
        matchesFilter(btPkg, {
          field: "originWarehouse",
          operator: "equals",
          value: "Bằng Tường",
        }),
        "Bằng Tường package matches Bằng Tường filter",
      );
      assert.ok(
        !matchesFilter(btPkg, {
          field: "originWarehouse",
          operator: "equals",
          value: "Quảng Châu",
        }),
        "Bằng Tường package does NOT match Quảng Châu filter",
      );
    });
  });
});
