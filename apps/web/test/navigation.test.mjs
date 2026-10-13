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

/**
 * Approved navigation contract representing the authoritative product scope
 * defined in ADR-002 and task requirements.
 */
export const APPROVED_NAVIGATION_CONTRACT = [
  {
    id: "overview",
    href: "/",
    status: "available",
    group: "Workspace",
  },
  {
    id: "shipment",
    href: null,
    status: "planned",
    group: "Workspace",
  },
  {
    id: "parcels",
    href: "/logistics/parcels",
    status: "available",
    group: "Logistics",
  },
  {
    id: "customers",
    href: null,
    status: "planned",
    group: "Workspace",
  },
  {
    id: "system",
    href: "/system",
    status: "available",
    group: "System",
  },
  {
    id: "settings",
    href: "/settings",
    status: "available",
    group: "System",
  },
];

/**
 * Validates actual navigation items against an approved contract.
 * Detects unexpected items, missing items, duplicate IDs, incorrect routes,
 * invalid statuses, or planned items with navigable URLs.
 */
export function validateNavigationContract(actualItems, approvedContract) {
  const actualMap = new Map();
  for (const item of actualItems) {
    if (actualMap.has(item.id)) {
      throw new Error(`Duplicate navigation ID detected: '${item.id}'`);
    }
    actualMap.set(item.id, item);
  }

  const approvedMap = new Map(approvedContract.map((c) => [c.id, c]));

  // Check for unauthorized/unexpected items
  for (const id of actualMap.keys()) {
    if (!approvedMap.has(id)) {
      throw new Error(`Unauthorized navigation item detected: '${id}'`);
    }
  }

  // Check for missing items and exact properties
  for (const [id, expected] of approvedMap.entries()) {
    const actual = actualMap.get(id);
    if (!actual) {
      throw new Error(`Missing approved navigation item: '${id}'`);
    }
    if (actual.status !== expected.status) {
      throw new Error(
        `Navigation item '${id}' status mismatch: expected '${expected.status}', got '${actual.status}'`,
      );
    }
    if (actual.href !== expected.href) {
      throw new Error(
        `Navigation item '${id}' href mismatch: expected '${expected.href}', got '${actual.href}'`,
      );
    }
    if (actual.group !== expected.group) {
      throw new Error(
        `Navigation item '${id}' group mismatch: expected '${expected.group}', got '${actual.group}'`,
      );
    }
    if (actual.status === "planned" && actual.href !== null) {
      throw new Error(
        `Planned item '${id}' must have null href, found: '${actual.href}'`,
      );
    }
  }
}

test("Approved navigation contract validation", () => {
  // Validate production configuration against approved contract
  assert.doesNotThrow(() => {
    validateNavigationContract(NAVIGATION_ITEMS, APPROVED_NAVIGATION_CONTRACT);
  });

  // Verify each item has non-empty label and valid group in GROUP_LABELS
  for (const item of NAVIGATION_ITEMS) {
    assert.ok(item.label, `Item '${item.id}' must have label`);
    assert.ok(
      item.group in GROUP_LABELS,
      `Item '${item.id}' must belong to valid group`,
    );
  }
});

test("Navigation contract negative assertions", () => {
  // Negative 1: Unauthorized sourcing/wallet item must fail
  assert.throws(() => {
    validateNavigationContract(
      [
        ...APPROVED_NAVIGATION_CONTRACT.map((item) => ({ ...item })),
        {
          id: "sourcing-search",
          href: "/sourcing/search",
          status: "available",
          group: "Workspace",
        },
      ],
      APPROVED_NAVIGATION_CONTRACT,
    );
  }, /Unauthorized navigation item detected: 'sourcing-search'/);

  // Negative 2: Missing approved item must fail
  assert.throws(() => {
    validateNavigationContract(
      APPROVED_NAVIGATION_CONTRACT.filter((item) => item.id !== "settings"),
      APPROVED_NAVIGATION_CONTRACT,
    );
  }, /Missing approved navigation item: 'settings'/);

  // Negative 3: Planned item turned into available without updating contract must fail
  assert.throws(() => {
    validateNavigationContract(
      APPROVED_NAVIGATION_CONTRACT.map((item) =>
        item.id === "shipment"
          ? { ...item, status: "available", href: "/shipments" }
          : item,
      ),
      APPROVED_NAVIGATION_CONTRACT,
    );
  }, /status mismatch/);

  // Negative 4: Planned item with navigable URL must fail
  assert.throws(() => {
    validateNavigationContract(
      APPROVED_NAVIGATION_CONTRACT.map((item) =>
        item.id === "customers" ? { ...item, href: "/fake-route" } : item,
      ),
      APPROVED_NAVIGATION_CONTRACT,
    );
  }, /href mismatch/);

  // Negative 5: Duplicate ID must fail
  assert.throws(() => {
    validateNavigationContract(
      [...APPROVED_NAVIGATION_CONTRACT, APPROVED_NAVIGATION_CONTRACT[0]],
      APPROVED_NAVIGATION_CONTRACT,
    );
  }, /Duplicate navigation ID detected/);
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

  // Parcels route matching
  const parcels = NAVIGATION_ITEMS.find((i) => i.id === "parcels");
  assert.ok(parcels);
  assert.equal(isItemActive(parcels, "/logistics/parcels"), true);
  assert.equal(isItemActive(parcels, "/logistics/parcels/"), true);
  assert.equal(isItemActive(parcels, "/settings"), false);
});

test("resolveActiveItem identifies available routes and rejects fake ones", () => {
  const rootItem = resolveActiveItem("/");
  assert.equal(rootItem?.id, "overview");

  const systemItem = resolveActiveItem("/system");
  assert.equal(systemItem?.id, "system");

  const settingsItem = resolveActiveItem("/settings");
  assert.equal(settingsItem?.id, "settings");

  const parcelsItem = resolveActiveItem("/logistics/parcels");
  assert.equal(parcelsItem?.id, "parcels");

  // Trailing slash
  assert.equal(resolveActiveItem("/system/")?.id, "system");
  assert.equal(resolveActiveItem("/logistics/parcels/")?.id, "parcels");

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

  // Logistics parcels route
  const parcelsCrumbs = resolveBreadcrumbs("/logistics/parcels");
  assert.equal(parcelsCrumbs.length, 2);
  assert.equal(parcelsCrumbs[0].label, "Logistics");
  assert.equal(parcelsCrumbs[0].isCurrent, false);
  assert.equal(parcelsCrumbs[1].label, "Kiện hàng lẻ");
  assert.equal(parcelsCrumbs[1].href, "/logistics/parcels");
  assert.equal(parcelsCrumbs[1].isCurrent, true);

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
