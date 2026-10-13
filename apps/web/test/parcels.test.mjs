import test from "node:test";
import assert from "node:assert/strict";

import { FIXTURE_PARCELS } from "../features/parcels/fixtures/parcels.ts";
import {
  STATUS_TABS,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from "../features/parcels/types.ts";
import {
  formatVnd,
  formatWeight,
  formatDate,
  parsePageSize,
} from "../features/parcels/utils.ts";
import {
  PARCEL_COLUMNS,
  DEFAULT_VISIBLE_COLUMNS,
  parseStoredColumns,
  serializeColumns,
  getOrderedVisibleColumns,
} from "../features/parcels/columns.ts";

test("Parcels fixtures integrity", () => {
  assert.ok(
    FIXTURE_PARCELS.length >= 18,
    "Fixture must contain at least 18 items",
  );

  const trackingNumbers = new Set();
  const ids = new Set();
  const foundStatuses = new Set();

  for (const parcel of FIXTURE_PARCELS) {
    assert.ok(parcel.id, "Parcel must have ID");
    assert.ok(!ids.has(parcel.id), `Duplicate ID detected: ${parcel.id}`);
    ids.add(parcel.id);

    assert.ok(parcel.trackingNumber, "Parcel must have tracking number");
    assert.ok(
      !trackingNumbers.has(parcel.trackingNumber),
      `Duplicate tracking number detected: ${parcel.trackingNumber}`,
    );
    trackingNumbers.add(parcel.trackingNumber);

    assert.ok(parcel.status, "Parcel must have status");
    assert.ok(parcel.statusLabel, "Parcel must have status label");
    foundStatuses.add(parcel.status);

    assert.ok(parcel.weightKg > 0, "Weight must be positive");
    assert.ok(parcel.totalAmount >= 0, "Total amount must be non-negative");
    assert.ok(parcel.packageCount >= 1, "Package count must be at least 1");
    assert.ok(parcel.itemCount >= 1, "Item count must be at least 1");
  }

  for (const tab of STATUS_TABS) {
    if (tab.key !== "all") {
      assert.ok(
        foundStatuses.has(tab.key),
        `Status tab '${tab.key}' must have fixture items`,
      );
    }
  }
});

test("Parcels formatting helpers", () => {
  assert.equal(formatVnd(250000), "250.000\u00A0₫".replace(/\u00A0/, " "));
  assert.equal(formatWeight(1.5), "1.5 kg");
  assert.equal(formatWeight(2), "2 kg");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("2026-10-10 14:00"), "2026-10-10 14:00");
});

test("Column configuration: default visible columns contract", () => {
  assert.equal(
    DEFAULT_VISIBLE_COLUMNS.length,
    7,
    "Default visible columns must be exactly 7",
  );
  assert.deepEqual(Array.from(DEFAULT_VISIBLE_COLUMNS), [
    "trackingNumber",
    "productName",
    "status",
    "weightKg",
    "totalAmount",
    "packageCount",
    "itemCount",
  ]);

  const trackingDef = PARCEL_COLUMNS.find((c) => c.id === "trackingNumber");
  assert.equal(
    trackingDef?.isRequired,
    true,
    "Tracking number must be marked required",
  );
});

test("Column configuration: parseStoredColumns edge cases and resilience", () => {
  // Null or undefined returns defaults
  const fromNull = parseStoredColumns(null);
  assert.deepEqual(Array.from(fromNull), Array.from(DEFAULT_VISIBLE_COLUMNS));

  // Invalid JSON returns defaults
  const fromInvalid = parseStoredColumns("not-valid-json{");
  assert.deepEqual(
    Array.from(fromInvalid),
    Array.from(DEFAULT_VISIBLE_COLUMNS),
  );

  // Non-array returns defaults
  const fromObject = parseStoredColumns('{"trackingNumber": true}');
  assert.deepEqual(Array.from(fromObject), Array.from(DEFAULT_VISIBLE_COLUMNS));

  // Empty array returns defaults (prevents 0 columns)
  const fromEmpty = parseStoredColumns("[]");
  assert.deepEqual(Array.from(fromEmpty), Array.from(DEFAULT_VISIBLE_COLUMNS));

  // Array with only unknown keys returns defaults
  const fromUnknown = parseStoredColumns('["unknownCol1", "unknownCol2"]');
  assert.deepEqual(
    Array.from(fromUnknown),
    Array.from(DEFAULT_VISIBLE_COLUMNS),
  );

  // Array without required trackingNumber gets trackingNumber added back
  const withoutTracking = parseStoredColumns('["productName", "status"]');
  assert.ok(withoutTracking.has("trackingNumber"));
  assert.ok(withoutTracking.has("productName"));
  assert.ok(withoutTracking.has("status"));

  // Valid customization with optional columns preserves choices
  const validCustom = parseStoredColumns(
    '["trackingNumber", "productName", "unitPrice", "woodenCrate"]',
  );
  assert.equal(validCustom.size, 4);
  assert.ok(validCustom.has("unitPrice"));
  assert.ok(validCustom.has("woodenCrate"));
  assert.ok(!validCustom.has("totalAmount"));
});

test("Column configuration: serialization and stable ordering", () => {
  const chosenKeys = new Set(["productName", "declaredValue", "woodenCrate"]);
  const serialized = serializeColumns(chosenKeys);

  // Serialized string must always contain trackingNumber
  assert.ok(serialized.includes("trackingNumber"));
  assert.ok(serialized.includes("productName"));
  assert.ok(serialized.includes("declaredValue"));

  // getOrderedVisibleColumns must maintain the stable canonical order of PARCEL_COLUMNS
  const ordered = getOrderedVisibleColumns(
    new Set(["woodenCrate", "productName", "trackingNumber", "weightKg"]),
  );
  const orderedIds = ordered.map((c) => c.id);
  assert.deepEqual(orderedIds, [
    "trackingNumber",
    "productName",
    "weightKg",
    "woodenCrate",
  ]);
});

test("Page-size selector contract and parsePageSize resilience", () => {
  assert.deepEqual(Array.from(PAGE_SIZE_OPTIONS), [5, 10, 20, 50, 100]);
  assert.equal(DEFAULT_PAGE_SIZE, 10);

  // Missing or nullish values return default 10
  assert.equal(parsePageSize(null), 10);
  assert.equal(parsePageSize(undefined), 10);
  assert.equal(parsePageSize(""), 10);

  // Valid numbers and string numbers
  assert.equal(parsePageSize(5), 5);
  assert.equal(parsePageSize("5"), 5);
  assert.equal(parsePageSize(10), 10);
  assert.equal(parsePageSize("10"), 10);
  assert.equal(parsePageSize(20), 20);
  assert.equal(parsePageSize("20"), 20);
  assert.equal(parsePageSize(50), 50);
  assert.equal(parsePageSize("50"), 50);
  assert.equal(parsePageSize(100), 100);
  assert.equal(parsePageSize("100"), 100);

  // Invalid values fall back safely to DEFAULT_PAGE_SIZE (10)
  assert.equal(parsePageSize(0), 10);
  assert.equal(parsePageSize(8), 10);
  assert.equal(parsePageSize(-10), 10);
  assert.equal(parsePageSize(999), 10);
  assert.equal(parsePageSize("invalid"), 10);
  assert.equal(parsePageSize("NaN"), 10);
});

test("Filtering and pagination calculations across configurable page sizes", () => {
  // Test query filtering
  const query = "vn829";
  const filteredByTracking = FIXTURE_PARCELS.filter(
    (item) =>
      item.trackingNumber.toLowerCase().includes(query) ||
      item.productName.toLowerCase().includes(query),
  );
  assert.ok(filteredByTracking.length >= 1);
  assert.equal(filteredByTracking[0].trackingNumber, "VN829381923CN");

  // Test status filtering
  const inTransit = FIXTURE_PARCELS.filter(
    (item) => item.status === "in_transit",
  );
  assert.ok(inTransit.length >= 4);

  const total = FIXTURE_PARCELS.length;

  // Page size 5: totalPages = ceil(23 / 5) = 5
  const size5Pages = Math.ceil(total / 5);
  assert.equal(size5Pages, 5);
  const size5Page1 = FIXTURE_PARCELS.slice(0, 5);
  assert.equal(size5Page1.length, 5);
  const size5LastPage = FIXTURE_PARCELS.slice(4 * 5, 5 * 5);
  assert.equal(size5LastPage.length, total - 20);

  // Page size 10 (default): totalPages = ceil(23 / 10) = 3
  const size10Pages = Math.ceil(total / 10);
  assert.equal(size10Pages, 3);
  const size10Page1 = FIXTURE_PARCELS.slice(0, 10);
  assert.equal(size10Page1.length, 10);
  const size10LastPage = FIXTURE_PARCELS.slice(2 * 10, 3 * 10);
  assert.equal(size10LastPage.length, 3); // 23 - 20 = 3 items

  // Page size 20: totalPages = ceil(23 / 20) = 2
  const size20Pages = Math.ceil(total / 20);
  assert.equal(size20Pages, 2);
  const size20LastPage = FIXTURE_PARCELS.slice(20, 40);
  assert.equal(size20LastPage.length, 3);

  // Page size 50: totalPages = 1
  const size50Pages = Math.ceil(total / 50);
  assert.equal(size50Pages, 1);
  const size50Page1 = FIXTURE_PARCELS.slice(0, 50);
  assert.equal(size50Page1.length, total);

  // Page size 100: totalPages = 1
  const size100Pages = Math.ceil(total / 100);
  assert.equal(size100Pages, 1);
  const size100Page1 = FIXTURE_PARCELS.slice(0, 100);
  assert.equal(size100Page1.length, total);
});

test("Pagination clamping on page size transition or invalid query", () => {
  const total = FIXTURE_PARCELS.length; // 23
  const size = 20;
  const totalPages = Math.max(1, Math.ceil(total / size)); // 2

  // Page 5 clamped to totalPages (2)
  const requestedPage = 5;
  const safePage = Math.min(requestedPage, totalPages);
  assert.equal(safePage, 2);

  const startItem = (safePage - 1) * size + 1; // 21
  const endItem = Math.min(safePage * size, total); // 23
  assert.equal(startItem, 21);
  assert.equal(endItem, 23);
});
