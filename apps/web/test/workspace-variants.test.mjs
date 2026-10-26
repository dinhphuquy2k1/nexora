import test from "node:test";
import assert from "node:assert/strict";
import { NAVIGATION_ITEMS } from "../lib/navigation/nav-config.ts";
import { resolveWorkspaceVariant } from "../lib/navigation/resolve-active.ts";
test("available route metadata owns standard/wide and exact/nested/near-match resolution", () => {
  for (const path of [
    "/",
    "/settings",
    "/system",
    "/customers-near",
    "/unknown",
  ])
    assert.equal(resolveWorkspaceVariant(path), "standard");
  for (const path of ["/customers", "/customers/", "/customers/123"])
    assert.equal(resolveWorkspaceVariant(path), "wide");
  const base = {
    status: "available",
    group: "System",
    iconKey: "settings",
    label: "Settings",
  };
  const items = [
    { ...base, id: "parent", href: "/settings", contentVariant: "standard" },
    { ...base, id: "child", href: "/settings/nested", contentVariant: "wide" },
  ];
  assert.equal(resolveWorkspaceVariant("/settings/nested/one", items), "wide");
  assert.equal(
    resolveWorkspaceVariant("/settings/nested-near", items),
    "standard",
  );
  assert.equal(
    resolveWorkspaceVariant("/settings/nested", [
      { ...items[1], status: "planned" },
    ]),
    "standard",
  );
  assert.equal(
    NAVIGATION_ITEMS.find((i) => i.id === "customers").contentVariant,
    "wide",
  );
});
