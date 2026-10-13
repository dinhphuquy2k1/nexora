import test from "node:test";
import assert from "node:assert/strict";

import { FIXTURE_PARCELS } from "../features/parcels/fixtures/parcels.ts";
import { STATUS_TABS } from "../features/parcels/types.ts";
import {
  formatVnd,
  formatWeight,
  formatDate,
} from "../features/parcels/utils.ts";

test("Parcels fixtures integrity", () => {
  assert.ok(
    FIXTURE_PARCELS.length >= 18,
    "Fixture must contain at least 18 items",
  );

  const trackingNumbers = new Set();
  const ids = new Set();
  const foundStatuses = new Set();

  for (const parcel of FIXTURE_PARCELS) {
    // Unique tracking numbers and IDs
    assert.ok(parcel.id, "Parcel must have ID");
    assert.ok(!ids.has(parcel.id), `Duplicate ID detected: ${parcel.id}`);
    ids.add(parcel.id);

    assert.ok(parcel.trackingNumber, "Parcel must have tracking number");
    assert.ok(
      !trackingNumbers.has(parcel.trackingNumber),
      `Duplicate tracking number detected: ${parcel.trackingNumber}`,
    );
    trackingNumbers.add(parcel.trackingNumber);

    // Status validity
    assert.ok(parcel.status, "Parcel must have status");
    assert.ok(parcel.statusLabel, "Parcel must have status label");
    foundStatuses.add(parcel.status);

    // Numeric validity
    assert.ok(parcel.weightKg > 0, "Weight must be positive");
    assert.ok(parcel.totalAmount >= 0, "Total amount must be non-negative");
    assert.ok(parcel.packageCount >= 1, "Package count must be at least 1");
    assert.ok(parcel.itemCount >= 1, "Item count must be at least 1");
  }

  // Verify all non-"all" status tabs exist in fixture dataset
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
