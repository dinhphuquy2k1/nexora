import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
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

test("NavigationItem pointer focus prevention and keyboard focus preservation", () => {
  const navItemModule = loadComponent(
    new URL("../components/app-shell/NavigationItem.tsx", import.meta.url),
  );
  assert.ok(navItemModule.NavigationItem, "NavigationItem must be exported");

  const shipmentItem = NAVIGATION_ITEMS.find((i) => i.id === "shipment");
  assert.ok(shipmentItem, "shipment item must exist");

  // Render active shipment item element
  const activeElement = navItemModule.NavigationItem({
    item: shipmentItem,
    isActive: true,
    isCollapsed: false,
  });

  // Verify structure: container -> Link
  assert.equal(activeElement.type, "div");
  const link = activeElement.props.children[0];
  assert.equal(link.props.href, "/shipments/retail");
  assert.equal(link.props["aria-current"], "page");
  assert.equal(link.props["aria-label"], "Vận đơn");
  assert.match(link.props.className, /navItemActive/);

  // Active indicator present when active
  const indicator = link.props.children[0];
  assert.ok(indicator, "Active indicator must be rendered when active");

  // Verify onClick handler blurs on pointer clicks (event.detail > 0)
  assert.equal(typeof link.props.onClick, "function", "Link must have onClick");

  let blurred = false;
  const mockPointerEvent = {
    detail: 1,
    currentTarget: {
      blur() {
        blurred = true;
      },
    },
  };
  link.props.onClick(mockPointerEvent);
  assert.equal(
    blurred,
    true,
    "Pointer click (detail=1) must blur the element to clear focus outline",
  );

  // Verify onClick preserves keyboard activation focus (event.detail === 0)
  let keyboardBlurred = false;
  const mockKeyboardEvent = {
    detail: 0,
    currentTarget: {
      blur() {
        keyboardBlurred = true;
      },
    },
  };
  link.props.onClick(mockKeyboardEvent);
  assert.equal(
    keyboardBlurred,
    false,
    "Keyboard activation (detail=0) must NOT blur, preserving keyboard focus",
  );

  // Inactive item does not render active indicator or navItemActive
  const inactiveElement = navItemModule.NavigationItem({
    item: shipmentItem,
    isActive: false,
    isCollapsed: false,
  });
  const inactiveLink = inactiveElement.props.children[0];
  assert.equal(inactiveLink.props["aria-current"], undefined);
  assert.doesNotMatch(inactiveLink.props.className, /navItemActive/);

  // Collapsed item applies centered styling
  const collapsedElement = navItemModule.NavigationItem({
    item: shipmentItem,
    isActive: false,
    isCollapsed: true,
  });
  const collapsedLink = collapsedElement.props.children[0];
  assert.match(collapsedLink.props.className, /itemCentered/);
});

test("Sidebar styles define focus-visible on dark and no default outline or border", () => {
  const sidebarCss = readFileSync(
    new URL("../components/app-shell/Sidebar.module.css", import.meta.url),
    "utf8",
  );

  // Focus-visible rule must exist on dark theme
  assert.match(
    sidebarCss,
    /\.navItemLink:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring-on-dark\)/s,
    "navItemLink must have 2px focus-visible outline using --focus-ring-on-dark",
  );

  // navItemLink must not define any default outline or border
  assert.doesNotMatch(
    sidebarCss,
    /\.navItemLink\s*\{[^}]*outline:/s,
    "navItemLink must not have default outline",
  );
  assert.doesNotMatch(
    sidebarCss,
    /\.navItemLink\s*\{[^}]*border:/s,
    "navItemLink must not have default border",
  );

  // navItemActive must not define outline, border or box-shadow
  assert.doesNotMatch(
    sidebarCss,
    /\.navItemActive\s*\{[^}]*outline/s,
    "navItemActive must not have outline",
  );
  assert.doesNotMatch(
    sidebarCss,
    /\.navItemActive\s*\{[^}]*border/s,
    "navItemActive must not have border",
  );
  assert.doesNotMatch(
    sidebarCss,
    /\.navItemActive\s*\{[^}]*box-shadow/s,
    "navItemActive must not have box-shadow",
  );

  // activeIndicator must use --color-accent
  assert.match(
    sidebarCss,
    /\.activeIndicator\s*\{[^}]*background-color:\s*var\(--color-accent\)/s,
    "activeIndicator must use --color-accent",
  );
});

test("CDP browser verification: Sidebar pointer click blur and keyboard focus preservation", async (t) => {
  const executable =
    process.env.CHROME_BIN ||
    (existsSync("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : ["google-chrome", "chromium", "chromium-browser"].find((name) => {
          try {
            return (
              spawnSync(name, ["--version"], { stdio: "ignore" }).status === 0
            );
          } catch {
            return false;
          }
        }));

  if (!executable) {
    t.skip("Headless Chrome/Chromium binary not available for live CDP test");
    return;
  }

  const profile = await mkdtemp(join(tmpdir(), "nexora-nav-cdp-"));
  const chrome = spawn(
    executable,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );

  let port;
  for (let i = 0; i < 50; i++) {
    try {
      port = (
        await readFile(join(profile, "DevToolsActivePort"), "utf8")
      ).split("\n")[0];
      break;
    } catch {
      await delay(100);
    }
  }

  if (!port) {
    chrome.kill();
    await rm(profile, { recursive: true, force: true }).catch(() => {});
    t.skip("Could not bind DevTools port");
    return;
  }

  try {
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
      (r) => r.json(),
    );
    const pageTarget = targets.find((tr) => tr.type === "page") || targets[0];
    const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((res) => ws.addEventListener("open", res));

    let msgId = 1;
    const send = (method, params = {}) => {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        const handler = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.id === id) {
            ws.removeEventListener("message", handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    const evaluate = async (expression) => {
      const res = await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      return res.result?.value;
    };

    const testHtml = `
<!DOCTYPE html>
<html>
<head>
<style>
.navItemLink {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 32px;
  padding: 4px 12px;
  border-radius: 6px;
  background-color: transparent;
  color: #94a3b8;
  text-decoration: none;
}
.navItemLink:hover {
  background-color: rgba(255, 255, 255, 0.08);
}
.navItemLink:focus-visible {
  outline: 2px solid rgb(245, 138, 36);
  outline-offset: 2px;
}
.navItemActive {
  background-color: #1e3a5f;
  color: #ffffff;
  font-weight: 600;
}
.activeIndicator {
  width: 4px;
  height: 20px;
  background-color: rgb(245, 138, 36);
  margin-right: 8px;
}
</style>
</head>
<body>
  <button id="prevControl">Start</button>
  <a id="linkShipment" href="#shipment" class="navItemLink navItemActive">
    <span class="activeIndicator"></span>
    <span class="itemLabel">Vận đơn</span>
  </a>
  <a id="linkCustomer" href="#customers" class="navItemLink">
    <span class="itemLabel">Khách hàng</span>
  </a>
  <script>
    function bindNavItem(id) {
      const el = document.getElementById(id);
      el.addEventListener("click", (event) => {
        if (event.detail > 0) {
          event.currentTarget.blur();
        }
      });
    }
    bindNavItem("linkShipment");
    bindNavItem("linkCustomer");
  </script>
</body>
</html>
`;

    await send("Page.enable");
    const loadPromise = new Promise((res) => {
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.method === "Page.loadEventFired") {
          ws.removeEventListener("message", handler);
          res();
        }
      };
      ws.addEventListener("message", handler);
    });
    await send("Page.navigate", {
      url: `data:text/html,${encodeURIComponent(testHtml)}`,
    });
    await loadPromise;
    await delay(100);

    // Scenario 1: Tab to linkShipment (Keyboard Navigation) -> Focus indicator visible
    await evaluate('document.getElementById("prevControl").focus()');
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
    });
    await delay(100);

    const keyboardTabState = await evaluate(`(() => {
      const el = document.getElementById("linkShipment");
      const cs = getComputedStyle(el);
      return {
        activeId: document.activeElement?.id,
        matchesFocus: el.matches(":focus"),
        matchesFocusVisible: el.matches(":focus-visible"),
        outlineStyle: cs.outlineStyle,
        outlineWidth: cs.outlineWidth,
        outlineColor: cs.outlineColor,
      };
    })()`);

    assert.equal(keyboardTabState.activeId, "linkShipment");
    assert.equal(keyboardTabState.matchesFocusVisible, true);
    assert.equal(keyboardTabState.outlineStyle, "solid");
    assert.equal(keyboardTabState.outlineWidth, "2px");
    assert.equal(keyboardTabState.outlineColor, "rgb(245, 138, 36)");

    // Scenario 2: Enter on linkShipment (Keyboard Activation) -> Focus is NOT cleared
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await delay(100);

    const keyboardEnterState = await evaluate(`(() => {
      const el = document.getElementById("linkShipment");
      return {
        activeId: document.activeElement?.id,
        matchesFocusVisible: el.matches(":focus-visible"),
      };
    })()`);
    assert.equal(keyboardEnterState.activeId, "linkShipment");
    assert.equal(keyboardEnterState.matchesFocusVisible, true);

    // Scenario 3: Mouse Click on Vận đơn -> No orange outline after click
    await evaluate('document.getElementById("prevControl").focus()');
    const box = await evaluate(`(() => {
      const r = document.getElementById("linkShipment").getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`);

    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
    });
    await delay(100);

    const mouseClickState = await evaluate(`(() => {
      const el = document.getElementById("linkShipment");
      const cs = getComputedStyle(el);
      return {
        activeId: document.activeElement?.id,
        matchesFocus: el.matches(":focus"),
        matchesFocusVisible: el.matches(":focus-visible"),
        outlineStyle: cs.outlineStyle,
      };
    })()`);

    assert.notEqual(
      mouseClickState.activeId,
      "linkShipment",
      "Element must not retain focus after pointer click",
    );
    assert.equal(mouseClickState.matchesFocus, false);
    assert.equal(mouseClickState.matchesFocusVisible, false);
    assert.equal(mouseClickState.outlineStyle, "none");

    ws.close();
  } finally {
    chrome.kill();
    await delay(200);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
});
