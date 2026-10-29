import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadComponent } from "./helpers/render-component.mjs";

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
    contentVariant: "standard",
    href: "/",
    status: "available",
    group: "Workspace",
  },
  {
    id: "shipment",
    contentVariant: "wide",
    href: "/shipments/retail",
    status: "available",
    group: "Workspace",
  },
  {
    id: "customers",
    contentVariant: "wide",
    href: "/customers",
    status: "available",
    group: "Workspace",
  },
  {
    id: "system",
    contentVariant: "standard",
    href: "/system",
    status: "available",
    group: "System",
  },
  {
    id: "settings",
    contentVariant: "standard",
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
    if (actual.contentVariant !== expected.contentVariant) {
      throw new Error(`Navigation item '${id}' contentVariant mismatch`);
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

  // Negative 3: Status mismatch without updating contract must fail
  assert.throws(() => {
    validateNavigationContract(
      APPROVED_NAVIGATION_CONTRACT.map((item) =>
        item.id === "shipment"
          ? { ...item, status: "planned", href: null }
          : item,
      ),
      APPROVED_NAVIGATION_CONTRACT,
    );
  }, /status mismatch/);

  // Negative 4: Planned item with navigable URL must fail
  assert.throws(() => {
    validateNavigationContract(
      APPROVED_NAVIGATION_CONTRACT.map((item) =>
        item.id === "shipment" ? { ...item, href: "/fake-route" } : item,
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
  const customers = NAVIGATION_ITEMS.find((i) => i.id === "customers");
  const system = NAVIGATION_ITEMS.find((i) => i.id === "system");
  const settings = NAVIGATION_ITEMS.find((i) => i.id === "settings");

  assert.ok(overview && shipment && customers && system && settings);

  // Overview exact matching
  assert.equal(isItemActive(overview, "/"), true);
  assert.equal(isItemActive(overview, "/system"), false);
  assert.equal(isItemActive(overview, "/settings"), false);

  // Planned items are never active
  assert.equal(isItemActive(shipment, "/shipment"), false);
  assert.equal(isItemActive(shipment, null), false);

  // Customer route matching
  assert.equal(isItemActive(customers, "/customers"), true);
  assert.equal(isItemActive(customers, "/customers/"), true);
  assert.equal(isItemActive(customers, "/customers/c-123"), true);
  assert.equal(isItemActive(customers, "/customers-other"), false); // Prefix near-match rejected
  assert.equal(isItemActive(customers, "/"), false);
  assert.equal(isItemActive(customers, "/settings"), false);

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

  const customerItem = resolveActiveItem("/customers");
  assert.equal(customerItem?.id, "customers");

  const customerDetailItem = resolveActiveItem("/customers/c-001");
  assert.equal(customerDetailItem?.id, "customers");

  // Prefix near-match rejects
  assert.equal(resolveActiveItem("/customers-other"), null);

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

  // Customer list route
  const customerCrumbs = resolveBreadcrumbs("/customers");
  assert.equal(customerCrumbs.length, 2);
  assert.equal(customerCrumbs[0].label, "Không gian làm việc");
  assert.equal(customerCrumbs[0].isCurrent, false);
  assert.equal(customerCrumbs[1].label, "Khách hàng");
  assert.equal(customerCrumbs[1].href, "/customers");
  assert.equal(customerCrumbs[1].isCurrent, true);

  // Customer detail route
  const customerDetailCrumbs = resolveBreadcrumbs("/customers/c-001");
  assert.equal(customerDetailCrumbs.length, 2);
  assert.equal(customerDetailCrumbs[0].label, "Không gian làm việc");
  assert.equal(customerDetailCrumbs[0].isCurrent, false);
  assert.equal(customerDetailCrumbs[1].label, "Khách hàng");
  assert.equal(customerDetailCrumbs[1].href, "/customers");
  assert.equal(customerDetailCrumbs[1].isCurrent, true);

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

test("Navigation items set aria-current and mobile drawer dismisses on route/click", () => {
  const customers = NAVIGATION_ITEMS.find((i) => i.id === "customers");
  assert.equal(isItemActive(customers, "/customers"), true);
  assert.equal(isItemActive(customers, "/customers/123"), true);
  // Negative near-match must never activate aria-current
  assert.equal(isItemActive(customers, "/customers-fake"), false);

  // ShellClient source verifies mobile drawer dismisses when a link is clicked
  const shellSource = readFileSync(
    new URL("../components/app-shell/ShellClient.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    shellSource,
    /closest\("a\[href\]"\)\s*\)\s*dismiss\(\)/,
    "Mobile navigation container must dismiss on link click",
  );
  assert.match(
    shellSource,
    /useEffect\(\(\)\s*=>\s*\{\s*setMobileOpen\(false\);\s*\},?\s*\[pathname\]\)/,
    "Mobile drawer must dismiss on pathname change",
  );
});

test("navigation rejects unauthorized frame variants", () => {
  assert.throws(
    () =>
      validateNavigationContract(
        NAVIGATION_ITEMS.map((item) =>
          item.id === "customers"
            ? { ...item, contentVariant: "standard" }
            : item,
        ),
        APPROVED_NAVIGATION_CONTRACT,
      ),
    /contentVariant mismatch/,
  );
});

test("Sidebar retains main behavior without programmatic pointer blur", () => {
  const { NavigationItem } = loadComponent(
    new URL("../components/app-shell/NavigationItem.tsx", import.meta.url),
  );
  const item = NAVIGATION_ITEMS.find((n) => n.id === "shipment");
  const link = NavigationItem({ item, isActive: true, isCollapsed: false })
    .props.children[0];
  assert.equal(link.props.onClick, undefined);
  assert.equal(link.props.href, "/shipments/retail");
  assert.equal(link.props["aria-current"], "page");
});
