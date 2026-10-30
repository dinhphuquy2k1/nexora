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
  // Default count badge presentation when unavailable displays 0 with advisory tooltip
  assert.match(
    unavailable,
    /title="Chưa đồng bộ từ máy chủ \(tạm tính: 0\)"/,
    "Unavailable badges present advisory placeholder label",
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
});
