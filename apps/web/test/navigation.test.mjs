import test from "node:test";
import assert from "node:assert/strict";

import {
  NAVIGATION_ITEMS,
  GROUP_LABELS,
} from "../lib/navigation/nav-config.ts";
import {
  normalizePathname,
  isItemActive,
  resolveActiveItem,
  resolveBreadcrumbs,
} from "../lib/navigation/resolve-active.ts";

test("Navigation metadata consistency", () => {
  const ids = new Set();
  assert.equal(
    NAVIGATION_ITEMS.length,
    5,
    "Must contain exactly 5 navigation items",
  );

  for (const item of NAVIGATION_ITEMS) {
    assert.ok(item.id, "Item must have id");
    assert.ok(!ids.has(item.id), `Item id '${item.id}' must be unique`);
    ids.add(item.id);

    assert.ok(item.label, `Item '${item.id}' must have label`);
    assert.ok(
      item.group in GROUP_LABELS,
      `Item '${item.id}' must belong to valid group`,
    );

    if (item.status === "available") {
      assert.ok(
        typeof item.href === "string" && item.href.startsWith("/"),
        `Available item '${item.id}' must have absolute href`,
      );
    } else if (item.status === "planned") {
      assert.equal(
        item.href,
        null,
        `Planned item '${item.id}' must have null href (never navigate to fake routes)`,
      );
    } else {
      assert.fail(`Invalid status '${item.status}' for item '${item.id}'`);
    }
  }
});

test("normalizePathname edge cases", () => {
  assert.equal(normalizePathname(""), "/");
  assert.equal(normalizePathname(null), "/");
  assert.equal(normalizePathname(undefined), "/");
  assert.equal(normalizePathname("/"), "/");
  assert.equal(normalizePathname("/system/"), "/system");
  assert.equal(normalizePathname("/settings"), "/settings");
  assert.equal(normalizePathname("  /settings/  "), "/settings");
});

test("isItemActive matching logic", () => {
  const overview = NAVIGATION_ITEMS.find((i) => i.id === "overview");
  const shipment = NAVIGATION_ITEMS.find((i) => i.id === "shipment");
  const system = NAVIGATION_ITEMS.find((i) => i.id === "system");
  const settings = NAVIGATION_ITEMS.find((i) => i.id === "settings");

  assert.ok(overview && shipment && system && settings);

  // Overview exact matching
  assert.equal(isItemActive(overview, "/"), true);
  assert.equal(isItemActive(overview, "/system"), false);
  assert.equal(isItemActive(overview, "/settings"), false);

  // Planned items are never active
  assert.equal(isItemActive(shipment, "/shipment"), false);
  assert.equal(isItemActive(shipment, null), false);

  // System route matching
  assert.equal(isItemActive(system, "/system"), true);
  assert.equal(isItemActive(system, "/system/"), true);
  assert.equal(isItemActive(system, "/system/details"), true);
  assert.equal(isItemActive(system, "/"), false);
  assert.equal(isItemActive(system, "/settings"), false);

  // Settings route matching
  assert.equal(isItemActive(settings, "/settings"), true);
  assert.equal(isItemActive(settings, "/settings/"), true);
  assert.equal(isItemActive(settings, "/system"), false);
});

test("resolveActiveItem identifies available routes and rejects fake ones", () => {
  const rootItem = resolveActiveItem("/");
  assert.equal(rootItem?.id, "overview");

  const systemItem = resolveActiveItem("/system");
  assert.equal(systemItem?.id, "system");

  const settingsItem = resolveActiveItem("/settings");
  assert.equal(settingsItem?.id, "settings");

  // Trailing slash
  assert.equal(resolveActiveItem("/system/")?.id, "system");

  // Unknown or unapproved routes return null
  assert.equal(resolveActiveItem("/unknown"), null);
  assert.equal(resolveActiveItem("/sourcing/search"), null);
  assert.equal(resolveActiveItem("/taobao"), null);
  assert.equal(resolveActiveItem("/shipments"), null);
});

test("resolveBreadcrumbs builds accurate breadcrumb trails", () => {
  // Root route
  const rootCrumbs = resolveBreadcrumbs("/");
  assert.equal(rootCrumbs.length, 2);
  assert.equal(rootCrumbs[0].label, "Không gian làm việc");
  assert.equal(rootCrumbs[0].isCurrent, false);
  assert.equal(rootCrumbs[1].label, "Tổng quan");
  assert.equal(rootCrumbs[1].href, "/");
  assert.equal(rootCrumbs[1].isCurrent, true);

  // System route
  const systemCrumbs = resolveBreadcrumbs("/system");
  assert.equal(systemCrumbs.length, 2);
  assert.equal(systemCrumbs[0].label, "Hệ thống");
  assert.equal(systemCrumbs[0].isCurrent, false);
  assert.equal(systemCrumbs[1].label, "Trạng thái hệ thống");
  assert.equal(systemCrumbs[1].href, "/system");
  assert.equal(systemCrumbs[1].isCurrent, true);

  // Settings route
  const settingsCrumbs = resolveBreadcrumbs("/settings");
  assert.equal(settingsCrumbs.length, 2);
  assert.equal(settingsCrumbs[0].label, "Hệ thống");
  assert.equal(settingsCrumbs[0].isCurrent, false);
  assert.equal(settingsCrumbs[1].label, "Cài đặt");
  assert.equal(settingsCrumbs[1].href, "/settings");
  assert.equal(settingsCrumbs[1].isCurrent, true);

  // Unrecognized route
  const unknownCrumbs = resolveBreadcrumbs("/unknown-path");
  assert.equal(unknownCrumbs.length, 2);
  assert.equal(unknownCrumbs[0].label, "Hệ thống");
  assert.equal(unknownCrumbs[0].isCurrent, false);
  assert.equal(unknownCrumbs[1].label, "Không xác định");
  assert.equal(unknownCrumbs[1].isCurrent, true);
});
