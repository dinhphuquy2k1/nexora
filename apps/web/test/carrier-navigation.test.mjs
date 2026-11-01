import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveBreadcrumbs,
  resolveWorkspaceVariant,
} from "../lib/navigation/resolve-active.ts";
import { NAVIGATION_ITEMS } from "../lib/navigation/nav-config.ts";
test("carrier nested route retains Settings owner without a Sidebar item", () => {
  const crumbs = resolveBreadcrumbs("/settings/carrier-connections");
  assert.deepEqual(
    crumbs.map((c) => c.label),
    ["Hệ thống", "Cài đặt", "Kết nối hãng vận chuyển"],
  );
  assert.equal(crumbs[1].href, "/settings");
  assert.equal(crumbs[2].isCurrent, true);
  assert.equal(
    resolveWorkspaceVariant("/settings/carrier-connections"),
    "wide",
  );
  assert.equal(NAVIGATION_ITEMS.length, 5);
  assert.equal(
    resolveWorkspaceVariant("/settings/carrier-connections-other"),
    "standard",
  );
});
