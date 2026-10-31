import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  React,
  render,
  loadComponent,
} from "../../../scripts/test-helpers/render-component.mjs";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "../src/index.tsx");

describe("Shared TabBar & TabCountBadge contracts (@nexora/ui)", () => {
  const ui = loadComponent(indexPath);

  it("exports TabBar and TabCountBadge from @nexora/ui", () => {
    assert.strictEqual(typeof ui.TabBar, "function", "TabBar must be exported");
    assert.strictEqual(
      typeof ui.TabCountBadge,
      "function",
      "TabCountBadge must be exported",
    );
  });

  const mockItems = [
    {
      id: "tab1",
      title: "Tab One",
      icon: React.createElement("span", { "data-testid": "icon-1" }, "★"),
    },
    { id: "tab2", title: "Tab Two", disabled: true },
    { id: "tab3", title: "Tab Three" },
  ];

  it("renders tablist with correct ARIA semantics and items", () => {
    const html = render(
      React.createElement(ui.TabBar, {
        items: mockItems,
        value: "tab1",
        onValueChange: () => {},
        idPrefix: "test-tab",
        panelId: "test-panel",
        ariaLabel: "Test tab bar",
      }),
    );

    assert.ok(html.includes('role="tablist"'), "must have role='tablist'");
    assert.ok(
      html.includes('aria-label="Test tab bar"'),
      "must have aria-label",
    );
    assert.ok(
      html.includes('id="test-tab-tab1"'),
      "generates idPrefix-id for tab1",
    );
    assert.ok(
      html.includes('id="test-tab-tab2"'),
      "generates idPrefix-id for tab2",
    );
    assert.ok(
      html.includes('id="test-tab-tab3"'),
      "generates idPrefix-id for tab3",
    );
    assert.ok(
      html.includes('aria-controls="test-panel"'),
      "has aria-controls pointing to panelId",
    );
  });

  it("sets aria-selected and roving tabIndex correctly on active vs inactive items", () => {
    const html = render(
      React.createElement(ui.TabBar, {
        items: mockItems,
        value: "tab1",
        onValueChange: () => {},
        idPrefix: "test-tab",
        panelId: "test-panel",
        ariaLabel: "Test tab bar",
      }),
    );

    // tab1 is selected: aria-selected="true", tabIndex=0
    assert.ok(html.includes('id="test-tab-tab1"'));
    assert.match(html, /id="test-tab-tab1"[^>]*aria-selected="true"/);
    assert.match(html, /id="test-tab-tab1"[^>]*tabindex="0"/i);

    // tab3 is unselected: aria-selected="false", tabIndex=-1
    assert.match(html, /id="test-tab-tab3"[^>]*aria-selected="false"/);
    assert.match(html, /id="test-tab-tab3"[^>]*tabindex="-1"/i);
  });

  it("renders disabled state on disabled items", () => {
    const html = render(
      React.createElement(ui.TabBar, {
        items: mockItems,
        value: "tab1",
        onValueChange: () => {},
        idPrefix: "test-tab",
        panelId: "test-panel",
        ariaLabel: "Test tab bar",
      }),
    );

    assert.match(html, /id="test-tab-tab2"[^>]*disabled/);
    assert.match(html, /id="test-tab-tab2"[^>]*aria-disabled="true"/);
  });

  it("renders custom trailing slot per item with active state passed", () => {
    const html = render(
      React.createElement(ui.TabBar, {
        items: mockItems,
        value: "tab1",
        onValueChange: () => {},
        idPrefix: "test-tab",
        panelId: "test-panel",
        ariaLabel: "Test tab bar",
        renderTrailing: (item, { active }) =>
          React.createElement(
            "span",
            {
              "data-testid": `badge-${item.id}`,
              "data-active": String(active),
            },
            item.id,
          ),
      }),
    );

    assert.ok(html.includes('data-testid="badge-tab1"'));
    assert.ok(html.includes('data-active="true"'));
    assert.ok(html.includes('data-testid="badge-tab3"'));
    assert.ok(html.includes('data-active="false"'));
  });

  it("applies activeIconColor to icon container only when item is active", () => {
    const itemsWithColor = [
      {
        id: "tab1",
        title: "Tab One",
        icon: React.createElement("span", { "data-testid": "icon-1" }, "★"),
        activeIconColor: "var(--color-retail-tab-all-icon)",
      },
      {
        id: "tab2",
        title: "Tab Two",
        icon: React.createElement("span", { "data-testid": "icon-2" }, "▲"),
        activeIconColor: "var(--color-retail-tab-to-origin-icon)",
      },
    ];

    const html = render(
      React.createElement(ui.TabBar, {
        items: itemsWithColor,
        value: "tab1",
        onValueChange: () => {},
        idPrefix: "test-tab",
        panelId: "test-panel",
        ariaLabel: "Test tab bar",
      }),
    );

    // tab1 is active: must have style="color:var(--color-retail-tab-all-icon)"
    assert.match(
      html,
      /color:\s*var\(--color-retail-tab-all-icon\)/,
      "Active tab icon receives activeIconColor",
    );
    // tab2 is inactive: must NOT have active color style applied
    assert.doesNotMatch(
      html,
      /color:\s*var\(--color-retail-tab-to-origin-icon\)/,
      "Inactive tab icon does not receive activeIconColor",
    );
  });

  describe("TabCountBadge rendering", () => {
    it("renders '0' when value is 0", () => {
      const html = render(React.createElement(ui.TabCountBadge, { value: 0 }));
      assert.ok(html.includes(">0<"), "Must render 0 verbatim");
      assert.ok(!html.includes("—"), "Must not render em-dash for 0");
    });

    it("renders positive number when value > 0", () => {
      const html = render(React.createElement(ui.TabCountBadge, { value: 42 }));
      assert.ok(html.includes(">42<"), "Must render 42");
    });

    it("renders '—' when value is undefined", () => {
      const html = render(
        React.createElement(ui.TabCountBadge, { value: undefined }),
      );
      assert.ok(
        html.includes(">—<"),
        "Must render em-dash for undefined count",
      );
    });

    it("renders with custom title and ariaLabel for accessibility", () => {
      const html = render(
        React.createElement(ui.TabCountBadge, {
          value: 0,
          title: "Chưa đồng bộ (0)",
          ariaLabel: "0 kiện",
        }),
      );
      assert.ok(
        html.includes('title="Chưa đồng bộ (0)"'),
        "Must have title attribute",
      );
      assert.ok(
        html.includes('aria-label="0 kiện"'),
        "Must have aria-label attribute",
      );
    });

    it("applies active styles/attributes when active=true", () => {
      const htmlActive = render(
        React.createElement(ui.TabCountBadge, { value: 5, active: true }),
      );
      const htmlInactive = render(
        React.createElement(ui.TabCountBadge, { value: 5, active: false }),
      );
      assert.ok(
        htmlActive.includes("badgeActive"),
        "Has active badge class or attribute",
      );
      assert.ok(
        htmlInactive.includes("badgeInactive"),
        "Has inactive badge class or attribute",
      );
    });

    it("renders srText in srOnly element and aria-hidden on visual text", () => {
      const html = render(
        React.createElement(ui.TabCountBadge, {
          value: undefined,
          srText: "chưa có dữ liệu",
        }),
      );
      assert.ok(
        html.includes('aria-hidden="true">—</span>'),
        "Visual em-dash must be aria-hidden",
      );
      assert.ok(
        html.includes("chưa có dữ liệu</span>"),
        "Must contain screen reader text",
      );
      assert.ok(
        html.includes("srOnly"),
        "Screen reader text must have srOnly class",
      );
    });

    it("does not render srOnly element when srText is absent", () => {
      const html = render(React.createElement(ui.TabCountBadge, { value: 12 }));
      assert.ok(html.includes(">12<"), "Visual count rendered");
      assert.ok(!html.includes("srOnly"), "No srOnly class when srText absent");
    });
  });

  describe("TabBar roving tabindex fallback with disabled tabs", () => {
    it("falls back to first enabled tab when active value tab is disabled", () => {
      const items = [
        { id: "tab1", title: "Tab 1", disabled: true },
        { id: "tab2", title: "Tab 2", disabled: false },
        { id: "tab3", title: "Tab 3", disabled: false },
      ];
      const html = render(
        React.createElement(ui.TabBar, {
          items,
          value: "tab1",
          onValueChange: () => {},
          idPrefix: "test-tab",
          panelId: "test-panel",
          ariaLabel: "Test tab bar",
        }),
      );
      // tab1 is disabled: tabIndex must be -1
      assert.match(
        html,
        /id="test-tab-tab1"[^>]*tabindex="-1"/i,
        "Disabled tab1 cannot have roving tabIndex 0",
      );
      // tab2 is first enabled: tabIndex must be 0
      assert.match(
        html,
        /id="test-tab-tab2"[^>]*tabindex="0"/i,
        "First enabled tab receives roving tabIndex 0",
      );
    });
  });
});
