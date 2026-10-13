import test from "node:test";
import assert from "node:assert/strict";

import { FIXTURE_PARCELS } from "../features/parcels/fixtures/parcels.ts";
import { STATUS_TABS } from "../features/parcels/types.ts";
import {
  formatVnd,
  formatWeight,
  formatDate,
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

test("Filtering and pagination calculations", () => {
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

  // Pagination calculation
  const pageSize = 8;
  const total = FIXTURE_PARCELS.length;
  const totalPages = Math.ceil(total / pageSize);
  assert.ok(totalPages >= 3);

  const page1 = FIXTURE_PARCELS.slice(0, pageSize);
  assert.equal(page1.length, pageSize);

  const page3 = FIXTURE_PARCELS.slice(2 * pageSize, 3 * pageSize);
  assert.equal(page3.length, total - 2 * pageSize);
});
