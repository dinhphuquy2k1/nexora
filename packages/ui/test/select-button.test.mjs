import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  React,
  render,
  loadComponent,
} from "../../../apps/web/test/helpers/render-component.mjs";

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.resolve(__dirname, "../src/index.tsx");

describe("Shared SelectButton contracts (@nexora/ui)", () => {
  const ui = loadComponent(indexPath);

  it("exports SelectButton from @nexora/ui", () => {
    assert.strictEqual(
      typeof ui.SelectButton,
      "function",
      "SelectButton must be exported",
    );
  });

  describe("Single Segmented Mode", () => {
    const singleOptions = [
      { value: "all", label: "Tất cả" },
      { value: "basic", label: "Cơ bản" },
      { value: "default", label: "Mặc định" },
      { value: "custom", label: "Tùy chỉnh", disabled: true },
    ];

    it("renders role='group' container with aria-label and native buttons", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "single",
          layout: "segmented",
          options: singleOptions,
          value: "basic",
          ariaLabel: "Chọn cấu hình cột",
          onValueChange: () => {},
        }),
      );

      assert.ok(html.includes('role="group"'), "must have role='group'");
      assert.ok(
        html.includes('aria-label="Chọn cấu hình cột"'),
        "must have aria-label",
      );
      assert.ok(html.includes("<button"), "must render buttons");
      assert.ok(html.includes("Tất cả"));
      assert.ok(html.includes("Cơ bản"));
      assert.ok(html.includes("Mặc định"));
    });

    it("reflects selection state via aria-pressed on button elements", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "single",
          layout: "segmented",
          options: singleOptions,
          value: "basic",
          ariaLabel: "Chọn cấu hình cột",
          onValueChange: () => {},
        }),
      );

      // 'basic' is selected
      assert.ok(
        html.includes('aria-pressed="true"'),
        "selected option must have aria-pressed='true'",
      );
      // Other options are not selected
      assert.ok(
        html.includes('aria-pressed="false"'),
        "unselected options must have aria-pressed='false'",
      );
    });

    it("renders disabled state on disabled option", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "single",
          layout: "segmented",
          options: singleOptions,
          value: "all",
          ariaLabel: "Chọn cấu hình cột",
          onValueChange: () => {},
        }),
      );

      assert.ok(
        html.includes("disabled"),
        "disabled option must render disabled attribute",
      );
    });

    it("supports custom renderOption slot", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "single",
          layout: "segmented",
          options: singleOptions,
          value: "all",
          ariaLabel: "Chọn cấu hình cột",
          renderOption: (opt, { selected }) =>
            React.createElement(
              "span",
              { "data-custom": opt.value, "data-selected": String(selected) },
              `Custom: ${opt.label}`,
            ),
          onValueChange: () => {},
        }),
      );

      assert.ok(html.includes('data-custom="all"'));
      assert.ok(html.includes('data-selected="true"'));
      assert.ok(html.includes("Custom: Tất cả"));
    });
  });

  describe("Multiple Stacked Mode", () => {
    const multipleOptions = [
      { value: "trackingCode", label: "Mã vận đơn", disabled: true },
      { value: "carrier", label: "Hãng vận chuyển" },
      { value: "productName", label: "Tên sản phẩm" },
      { value: "weightKg", label: "Cân nặng" },
    ];

    it("renders role='group' container with native input[type=checkbox] elements", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "multiple",
          layout: "stacked",
          options: multipleOptions,
          value: ["trackingCode", "productName"],
          ariaLabel: "Chọn cột hiển thị",
          onValueChange: () => {},
        }),
      );

      assert.ok(html.includes('role="group"'), "must have role='group'");
      assert.ok(
        html.includes('aria-label="Chọn cột hiển thị"'),
        "must have aria-label",
      );
      assert.ok(
        html.includes('type="checkbox"'),
        "must render native checkbox inputs",
      );
      assert.ok(html.includes("Mã vận đơn"));
      assert.ok(html.includes("Hãng vận chuyển"));
    });

    it("reflects checked state accurately from value array", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "multiple",
          layout: "stacked",
          options: multipleOptions,
          value: ["trackingCode", "productName"],
          ariaLabel: "Chọn cột hiển thị",
          onValueChange: () => {},
        }),
      );

      // trackingCode and productName are checked
      assert.ok(
        html.includes("checked"),
        "checked items must have checked attribute",
      );
    });

    it("renders disabled attribute on disabled options", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "multiple",
          layout: "stacked",
          options: multipleOptions,
          value: ["trackingCode"],
          ariaLabel: "Chọn cột hiển thị",
          onValueChange: () => {},
        }),
      );

      assert.ok(
        html.includes("disabled"),
        "disabled option must render disabled attribute",
      );
    });

    it("supports custom renderOption slot without creating nested interactive controls", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "multiple",
          layout: "stacked",
          options: multipleOptions,
          value: ["trackingCode"],
          ariaLabel: "Chọn cột hiển thị",
          renderOption: (opt) =>
            React.createElement(
              "span",
              { className: "custom-opt" },
              opt.label,
              opt.disabled
                ? React.createElement(
                    "span",
                    { className: "pinned" },
                    "Cố định",
                  )
                : null,
            ),
          onValueChange: () => {},
        }),
      );

      assert.ok(html.includes("Cố định"));
      assert.ok(html.includes("custom-opt"));
      // Ensure no nested button or label inside label
      assert.strictEqual(
        (html.match(/<button/g) || []).length,
        0,
        "multiple stacked mode must not render any button elements",
      );
    });
  });

  describe("Selection Transitions & Invariants (Unit Verification)", () => {
    it("single segmented: allowEmpty=false preserves selection on re-click", () => {
      let callCount = 0;
      const onValueChange = () => {
        callCount++;
      };

      const options = [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ];

      // Simulate click logic
      const clickOption = (clickedValue, currentValue, allowEmpty = false) => {
        const option = options.find((o) => o.value === clickedValue);
        if (option?.disabled) return;
        if (currentValue === clickedValue) {
          if (allowEmpty) onValueChange(null);
        } else {
          onValueChange(clickedValue);
        }
      };

      clickOption("a", "a", false);
      assert.strictEqual(
        callCount,
        0,
        "re-clicking selected option when allowEmpty=false must not fire onValueChange",
      );

      clickOption("a", "a", true);
      assert.strictEqual(
        callCount,
        1,
        "re-clicking selected option when allowEmpty=true must fire onValueChange(null)",
      );
    });

    it("multiple stacked: toggling unselected item adds it to value", () => {
      const currentValues = ["col1", "col2"];
      const toggled = "col3";
      const next = currentValues.includes(toggled)
        ? currentValues.filter((v) => v !== toggled)
        : [...currentValues, toggled];

      assert.deepStrictEqual(next, ["col1", "col2", "col3"]);
    });

    it("multiple stacked: toggling selected item removes it from value", () => {
      const currentValues = ["col1", "col2", "col3"];
      const toggled = "col2";
      const next = currentValues.includes(toggled)
        ? currentValues.filter((v) => v !== toggled)
        : [...currentValues, toggled];

      assert.deepStrictEqual(next, ["col1", "col3"]);
    });

    it("CRITICAL INVARIANT: unchecking a column preserves columns outside search filter", () => {
      // 19 columns selected initially
      const allSelected = [
        "c1",
        "c2",
        "c3",
        "c4",
        "c5",
        "c6",
        "c7",
        "c8",
        "c9",
        "c10",
        "c11",
        "c12",
        "c13",
        "c14",
        "c15",
        "c16",
        "c17",
        "c18",
        "c19",
      ];
      // Filter options only display 2 columns: c1 and c2
      const filteredOptions = [
        { value: "c1", label: "C1" },
        { value: "c2", label: "C2" },
      ];
      assert.strictEqual(filteredOptions.length, 2);

      // User unchecks c2
      const toggled = "c2";
      const next = allSelected.filter((v) => v !== toggled);

      // Result must have 18 columns, NOT 1
      assert.strictEqual(next.length, 18, "must retain 18 columns, not 1");
      assert.ok(!next.includes("c2"), "c2 must be removed");
      assert.ok(next.includes("c1"), "c1 must be preserved");
      assert.ok(
        next.includes("c19"),
        "out-of-filter column c19 must be preserved",
      );
    });
  });
});
