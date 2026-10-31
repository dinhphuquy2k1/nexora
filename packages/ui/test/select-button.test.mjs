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

    it("supports appearance='text-actions' rendering decorative separators", () => {
      const html = render(
        React.createElement(ui.SelectButton, {
          mode: "single",
          layout: "segmented",
          appearance: "text-actions",
          options: singleOptions,
          value: "all",
          ariaLabel: "Chọn cấu hình cột",
          onValueChange: () => {},
        }),
      );

      assert.ok(
        html.includes("textActions"),
        "container must include textActions class",
      );
      assert.ok(
        html.includes("textActionsSeparator"),
        "must render textActionsSeparator elements",
      );
      assert.ok(
        html.includes('aria-hidden="true"'),
        "separators must be marked aria-hidden='true'",
      );
      // There are singleOptions.length options, so exactly length - 1 separators
      const separatorCount = (html.match(/textActionsSeparator/g) || []).length;
      assert.strictEqual(
        separatorCount,
        singleOptions.length - 1,
        "must render exactly (options.length - 1) separators",
      );
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
    it("exports nextSingleSelection and nextMultipleSelection helpers from @nexora/ui", () => {
      assert.strictEqual(
        typeof ui.nextSingleSelection,
        "function",
        "nextSingleSelection must be exported",
      );
      assert.strictEqual(
        typeof ui.nextMultipleSelection,
        "function",
        "nextMultipleSelection must be exported",
      );
    });

    it("pure helper: nextSingleSelection handles transitions and allowEmpty", () => {
      // Transition from null to selected
      assert.strictEqual(ui.nextSingleSelection(null, "basic"), "basic");
      // Transition from one option to another
      assert.strictEqual(ui.nextSingleSelection("basic", "all"), "all");
      // Re-click when allowEmpty=false preserves selection
      assert.strictEqual(
        ui.nextSingleSelection("basic", "basic", false),
        "basic",
      );
      // Re-click when allowEmpty=true deselects to null
      assert.strictEqual(ui.nextSingleSelection("basic", "basic", true), null);
    });

    it("pure helper: nextMultipleSelection handles adding, removing, and immutability", () => {
      const initial = ["col1", "col2"];
      // Add unselected
      const added = ui.nextMultipleSelection(initial, "col3", true);
      assert.deepStrictEqual([...added], ["col1", "col2", "col3"]);
      assert.notStrictEqual(added, initial, "must return a new array");

      // Remove selected
      const removed = ui.nextMultipleSelection(added, "col2", false);
      assert.deepStrictEqual([...removed], ["col1", "col3"]);

      // Idempotent add already selected
      const reAdd = ui.nextMultipleSelection(initial, "col1", true);
      assert.deepStrictEqual([...reAdd], ["col1", "col2"]);

      // Idempotent remove not selected
      const reRemove = ui.nextMultipleSelection(initial, "col3", false);
      assert.deepStrictEqual([...reRemove], ["col1", "col2"]);
    });

    it("CRITICAL INVARIANT: nextMultipleSelection preserves columns outside search filter", () => {
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

      // User unchecks c2 via production helper
      const next = ui.nextMultipleSelection(allSelected, "c2", false);

      // Result must have 18 columns, NOT 1
      assert.strictEqual(next.length, 18, "must retain 18 columns, not 1");
      assert.ok(!next.includes("c2"), "c2 must be removed");
      assert.ok(next.includes("c1"), "c1 must be preserved");
      assert.ok(
        next.includes("c19"),
        "out-of-filter column c19 must be preserved",
      );
    });

    it("component execution: single segmented SelectButton triggers onValueChange on click", () => {
      let firedValue = undefined;
      let callCount = 0;
      const options = [
        { value: "all", label: "Tất cả" },
        { value: "basic", label: "Cơ bản" },
        { value: "custom", label: "Tùy chỉnh", disabled: true },
      ];

      // 1. Click different option
      const vdom1 = ui.SelectButton({
        mode: "single",
        layout: "segmented",
        options,
        value: "all",
        ariaLabel: "Cấu hình cột",
        allowEmpty: false,
        onValueChange: (val) => {
          callCount++;
          firedValue = val;
        },
      });
      // Children are Button elements
      const buttons1 = vdom1.props.children;
      buttons1[1].props.onClick(); // Click "basic"
      assert.strictEqual(callCount, 1);
      assert.strictEqual(firedValue, "basic");

      // 2. Click disabled option does not fire
      callCount = 0;
      firedValue = undefined;
      buttons1[2].props.onClick(); // Click disabled "custom"
      assert.strictEqual(callCount, 0);
      assert.strictEqual(firedValue, undefined);

      // 3. Re-click active option when allowEmpty=false does not fire
      callCount = 0;
      firedValue = undefined;
      buttons1[0].props.onClick(); // Click active "all"
      assert.strictEqual(callCount, 0);
      assert.strictEqual(firedValue, undefined);

      // 4. Re-click active option when allowEmpty=true fires null
      const vdomAllowEmpty = ui.SelectButton({
        mode: "single",
        layout: "segmented",
        options,
        value: "all",
        ariaLabel: "Cấu hình cột",
        allowEmpty: true,
        onValueChange: (val) => {
          callCount++;
          firedValue = val;
        },
      });
      callCount = 0;
      firedValue = undefined;
      vdomAllowEmpty.props.children[0].props.onClick(); // Click active "all"
      assert.strictEqual(callCount, 1);
      assert.strictEqual(firedValue, null);
    });

    it("component execution: multiple stacked SelectButton triggers onValueChange on checkbox change", () => {
      let firedValues = undefined;
      let callCount = 0;
      const options = [
        { value: "trackingCode", label: "Mã vận đơn", disabled: true },
        { value: "carrier", label: "Hãng vận chuyển" },
        { value: "customerName", label: "Khách hàng" },
      ];

      const vdom = ui.SelectButton({
        mode: "multiple",
        layout: "stacked",
        options,
        value: ["trackingCode", "carrier"],
        ariaLabel: "Danh sách cột",
        onValueChange: (val) => {
          callCount++;
          firedValues = val;
        },
      });
      const checkboxes = vdom.props.children;

      // 1. Check unselected option
      checkboxes[2].props.onChange({ target: { checked: true } });
      assert.strictEqual(callCount, 1);
      assert.deepStrictEqual(
        [...firedValues],
        ["trackingCode", "carrier", "customerName"],
      );

      // 2. Uncheck selected option
      callCount = 0;
      checkboxes[1].props.onChange({ target: { checked: false } });
      assert.strictEqual(callCount, 1);
      assert.deepStrictEqual([...firedValues], ["trackingCode"]);

      // 3. Attempting to change disabled option does not fire
      callCount = 0;
      firedValues = undefined;
      checkboxes[0].props.onChange({ target: { checked: false } });
      assert.strictEqual(callCount, 0);
      assert.strictEqual(firedValues, undefined);
    });
  });

  describe("Type-level contracts (F6)", () => {
    it("TypeScript compiler validates discriminated union: appearance is allowed on single segmented, rejected on multiple stacked", async () => {
      const ts = (await import("typescript")).default;
      const fixturePath = path.resolve(
        __dirname,
        "../src/__select-button-contract.fixture.ts",
      );
      const fixtureSource = [
        "import type { SelectButtonProps } from './SelectButton';",
        "",
        "// 1. Single segmented mode supports appearance='text-actions' and 'default'",
        "type ValidSingle1 = {",
        "  mode: 'single';",
        "  layout: 'segmented';",
        "  appearance: 'text-actions';",
        "  options: readonly [{ value: 'a'; label: 'A' }];",
        "  value: 'a';",
        "  ariaLabel: string;",
        "  onValueChange: (val: 'a' | null) => void;",
        "};",
        "const validSingle1: SelectButtonProps<'a'> = {} as ValidSingle1;",
        "",
        "type ValidSingle2 = {",
        "  mode: 'single';",
        "  layout: 'segmented';",
        "  appearance: 'default';",
        "  options: readonly [{ value: 'a'; label: 'A' }];",
        "  value: 'a';",
        "  ariaLabel: string;",
        "  onValueChange: (val: 'a' | null) => void;",
        "};",
        "const validSingle2: SelectButtonProps<'a'> = {} as ValidSingle2;",
        "",
        "// 2. Multiple stacked mode allows standard props without appearance",
        "type ValidMultiple = {",
        "  mode: 'multiple';",
        "  layout: 'stacked';",
        "  options: readonly [{ value: 'a'; label: 'A' }];",
        "  value: readonly ['a'];",
        "  ariaLabel: string;",
        "  onValueChange: (val: 'a'[]) => void;",
        "};",
        "const validMultiple: SelectButtonProps<'a'> = {} as ValidMultiple;",
        "",
        "// 3. Multiple stacked mode rejects appearance='text-actions'",
        "type InvalidMultiple = {",
        "  mode: 'multiple';",
        "  layout: 'stacked';",
        "  appearance: 'text-actions';",
        "  options: readonly [{ value: 'a'; label: 'A' }];",
        "  value: readonly ['a'];",
        "  ariaLabel: string;",
        "  onValueChange: (val: 'a'[]) => void;",
        "};",
        "// @ts-expect-error appearance is rejected on multiple stacked SelectButton",
        "const invalidMultiple: SelectButtonProps<'a'> = {} as InvalidMultiple;",
      ].join("\n");
      const configPath = path.resolve(__dirname, "../tsconfig.json");
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.resolve(__dirname, ".."),
      );
      const host = ts.createCompilerHost(parsed.options);
      const origReadFile = host.readFile.bind(host);
      const origFileExists = host.fileExists.bind(host);
      const isFixture = (p) =>
        p === fixturePath ||
        p.replace(/\\/g, "/") === fixturePath.replace(/\\/g, "/");

      host.readFile = (p) => (isFixture(p) ? fixtureSource : origReadFile(p));
      host.fileExists = (p) => isFixture(p) || origFileExists(p);

      const program = ts.createProgram(
        [...parsed.fileNames, fixturePath],
        { ...parsed.options, incremental: false, noEmit: true },
        host,
      );
      const errors = ts
        .getPreEmitDiagnostics(program)
        .filter((d) => d.category === ts.DiagnosticCategory.Error);

      assert.deepStrictEqual(
        errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")),
        [],
        "Fixture with @ts-expect-error on multiple stacked appearance must produce zero unhandled errors",
      );
    });
  });
});
