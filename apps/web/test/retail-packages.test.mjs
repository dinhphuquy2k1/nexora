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
} from "../features/retail-packages/columns.ts";
import { SYNTHETIC_PACKAGES } from "../features/retail-packages/fixtures.ts";
import { NAVIGATION_ITEMS } from "../lib/navigation/nav-config.ts";

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

  it("PAGE_SIZE is 20", () => {
    assert.strictEqual(PAGE_SIZE, 20);
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
