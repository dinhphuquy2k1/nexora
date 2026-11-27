import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { loadComponent, React, render } from "./helpers/render-component.mjs";
const { createElement } = React;
const renderToStaticMarkup = render;
const controls = () =>
  loadComponent(
    fileURLToPath(
      new URL("../../../packages/ui/src/Controls.tsx", import.meta.url),
    ),
  );
test("all compatible controls render omitted/default/medium/large sizes without leaking a numeric native size", () => {
  const exports = controls();
  for (const name of [
    "Button",
    "TextInput",
    "Select",
    "Textarea",
    "Checkbox",
  ]) {
    for (const size of [undefined, "default", "medium", "large"]) {
      const html = renderToStaticMarkup(
        createElement(exports[name], { size, "aria-label": name }),
      );
      assert.match(html, new RegExp(`data-size="${size ?? "default"}"`), name);
      assert.doesNotMatch(html, /\ssize="/);
    }
  }
  const html = renderToStaticMarkup(
    createElement(exports.Textarea, { rows: 6, defaultValue: "line1\nline2" }),
  );
  assert.match(html, /rows="6"/);
  assert.match(html, /line1\nline2/);
});
test("size and refs have a checked public TypeScript contract, rejecting native numeric size", () => {
  const filename = fileURLToPath(
    new URL(
      "../../../packages/ui/src/__size-contract.fixture.tsx",
      import.meta.url,
    ),
  );
  const source = `import {createRef} from 'react'; import {Button,TextInput,Select,Textarea,Checkbox} from './Controls';
  const b=<Button size="medium" ref={createRef<HTMLButtonElement>()}/>;
  const i=<TextInput size="large" type="number" ref={createRef<HTMLInputElement>()}/>;
  const s=<Select size="default" ref={createRef<HTMLSelectElement>()}/>;
  const t=<Textarea size="medium" rows={6}/>; const c=<Checkbox size="large"/>;
  // @ts-expect-error numeric native size conflicts with the shared variant API
  const n=<TextInput size={10}/>;
  // @ts-expect-error Select variants are names, not native listbox row counts
  const m=<Select size={4}/>;
  // @ts-expect-error unsupported variant
  const x=<Button size="small"/>;`;
  const configPath = fileURLToPath(
    new URL("../../../packages/ui/tsconfig.json", import.meta.url),
  );
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    fileURLToPath(new URL("../../../packages/ui/", import.meta.url)),
  );
  const host = ts.createCompilerHost(parsed.options);
  const read = host.readFile.bind(host),
    exists = host.fileExists.bind(host);
  const isFixture = (p) =>
    p === filename || p.replace(/\\/g, "/") === filename.replace(/\\/g, "/");
  host.readFile = (p) => (isFixture(p) ? source : read(p));
  host.fileExists = (p) => isFixture(p) || exists(p);
  const program = ts.createProgram(
    [...parsed.fileNames, filename],
    { ...parsed.options, incremental: false, noEmit: true },
    host,
  );
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.deepEqual(
    errors.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")),
    [],
  );
});

function readDesignSystemSources() {
  const readRel = (rel) =>
    fs.readFileSync(
      path.resolve(fileURLToPath(new URL(rel, import.meta.url))),
      "utf8",
    );
  return {
    tokens: readRel("../styles/tokens.css"),
    controls: readRel("../../../packages/ui/src/Controls.module.css"),
    selectButton: readRel("../../../packages/ui/src/SelectButton.module.css"),
    globals: readRel("../styles/globals.css"),
    customers: readRel("../features/customers/customers.module.css"),
    retail: readRel("../features/retail-packages/retail-packages.module.css"),
    carrier: readRel(
      "../features/carrier-connections/carrier-connections.module.css",
    ),
  };
}

function assertDesignSystemContracts(files) {
  assert.match(
    files.tokens,
    /--control-size-default:\s*36px;/,
    "default size 36px",
  );
  assert.match(
    files.tokens,
    /--control-size-medium:\s*40px;/,
    "medium size 40px",
  );
  assert.match(
    files.tokens,
    /--control-size-large:\s*48px;/,
    "large size 48px",
  );
  assert.match(
    files.tokens,
    /--icon-control-default:\s*16px;/,
    "default icon 16px",
  );
  assert.match(
    files.tokens,
    /--icon-control-medium:\s*18px;/,
    "medium icon 18px",
  );
  assert.match(
    files.tokens,
    /--icon-control-large:\s*20px;/,
    "large icon 20px",
  );
  assert.match(
    files.tokens,
    /--control-font-size:\s*var\(--type-button-label-size\);/,
    "control font size aliases semantic button label size (14px)",
  );
  assert.match(
    files.tokens,
    /--control-font-size-default:\s*var\(--control-font-size\);/,
    "default control font size resolves to --control-font-size",
  );
  assert.match(
    files.tokens,
    /--control-font-size-medium:\s*var\(--control-font-size\);/,
    "medium control font size resolves to --control-font-size",
  );
  assert.match(
    files.tokens,
    /--control-font-size-large:\s*var\(--font-size-xl\);/,
    "large control font size resolves to 16px (--font-size-xl)",
  );
  assert.match(files.tokens, /--control-line-height:\s*20px;/);
  assert.match(
    files.tokens,
    /--control-line-height-default:\s*var\(--control-line-height\);/,
  );
  assert.match(
    files.tokens,
    /--control-line-height-medium:\s*var\(--control-line-height\);/,
  );
  assert.match(files.tokens, /--control-line-height-large:\s*24px;/);
  assert.match(
    files.tokens,
    /--type-page-title-size:\s*var\(--font-size-2xl\);/,
  );
  assert.match(files.tokens, /--type-page-title-line-height:\s*28px;/);
  assert.match(
    files.tokens,
    /--type-section-heading-size:\s*var\(--font-size-xl\);/,
  );
  assert.match(files.tokens, /--type-body-size:\s*var\(--font-size-md\);/);
  assert.match(files.tokens, /--type-label-size:\s*var\(--font-size-md\);/);
  assert.match(files.tokens, /--type-label-line-height:\s*20px;/);
  assert.match(
    files.tokens,
    /--type-table-cell-size:\s*var\(--font-size-sm\);/,
    "table cell size preserves 12px density via --font-size-sm",
  );

  assert.match(
    files.controls,
    /\.size\[data-size="default"\]\s*\{[^}]*--_control-font-size:\s*var\(--control-font-size-default\);[^}]*--_control-line-height:\s*var\(--control-line-height-default\);/s,
  );
  assert.match(
    files.controls,
    /\.size\[data-size="medium"\]\s*\{[^}]*--_control-font-size:\s*var\(--control-font-size-medium\);[^}]*--_control-line-height:\s*var\(--control-line-height-medium\);/s,
  );
  assert.match(
    files.controls,
    /\.size\[data-size="large"\]\s*\{[^}]*--_control-font-size:\s*var\(--control-font-size-large\);[^}]*--_control-line-height:\s*var\(--control-line-height-large\);/s,
  );
  assert.match(
    files.controls,
    /\.button\s*\{[^}]*font-weight:\s*var\(--font-weight-medium\);/s,
  );
  assert.match(
    files.controls,
    /\.input\s*\{[^}]*font-weight:\s*var\(--font-weight-normal\);/s,
  );
  assert.match(
    files.controls,
    /\.textarea:not\(\[rows="1"\]\):not\(\[rows="2"\]\)\s*\{[^}]*min-height:\s*calc\(\s*var\(--_control-line-height\)\s*\*\s*3\s*\+\s*var\(--_control-padding-y\)\s*\*\s*2\s*\+\s*2px\s*\);/s,
    "Textarea 3-line minimum must use line-height and allow explicit rows=1/rows=2",
  );

  assert.match(
    files.tokens,
    /--type-card-heading-size:\s*var\(--font-size-md\);/,
  );
  assert.match(files.tokens, /--type-card-heading-line-height:\s*20px;/);
  for (const featureCss of [files.customers, files.retail, files.carrier]) {
    assert.match(
      featureCss,
      /font-size:\s*var\(--type-card-heading-size\);[^}]*line-height:\s*var\(--type-card-heading-line-height\);/s,
    );
    assert.doesNotMatch(
      featureCss,
      /line-height:\s*var\(--control-line-height\);/,
      "Feature headings must not depend on control line height",
    );
  }
  assert.match(
    files.retail,
    /\.colPickerSearchIcon\s*\{[^}]*width:\s*var\(--icon-control-default\);[^}]*height:\s*var\(--icon-control-default\);/s,
  );
  const pickerInput = files.retail.match(/\.colPickerSearchInput\s*\{([^}]+)\}/);
  assert.ok(pickerInput);
  assert.doesNotMatch(pickerInput[1], /font-size\s*:/);
  assert.match(pickerInput[1], /padding-left:\s*calc\([^;]*--icon-control-default/s);

  const segmentedItemMatch = files.selectButton.match(
    /\.segmentedItem\s*\{([^}]+)\}/,
  );
  assert.ok(segmentedItemMatch, ".segmentedItem selector must exist");
  assert.doesNotMatch(
    segmentedItemMatch[1],
    /font-size\s*:/,
    "standard SelectButton segmentedItem must inherit font-size from shared Button",
  );

  assert.match(
    files.globals,
    /h1\s*\{[^}]*font-size:\s*var\(--type-page-title-size\);[^}]*line-height:\s*var\(--type-page-title-line-height\);[^}]*font-weight:\s*var\(--font-weight-semibold\);/s,
  );
  assert.match(
    files.globals,
    /h2\s*\{[^}]*font-size:\s*var\(--type-section-heading-size\);[^}]*font-weight:\s*var\(--font-weight-semibold\);/s,
  );

  for (const [label, featureCss, h1Selector] of [
    ["customers", files.customers, /\.titleGroup h1\s*\{/],
    ["retail", files.retail, /\.titleGroup h1\s*\{/],
    ["carrier", files.carrier, /\.heading h1\s*\{/],
  ]) {
    const h1Block = featureCss.match(
      new RegExp(h1Selector.source + "([^}]+)\\}"),
    );
    assert.ok(h1Block, `${label} h1 block must exist`);
    assert.match(
      h1Block[1],
      /font-size:\s*var\(--type-page-title-size\);/,
      `${label} h1 must consume --type-page-title-size`,
    );
    assert.match(
      h1Block[1],
      /font-weight:\s*var\(--font-weight-semibold\);/,
      `${label} h1 must use semibold weight (600)`,
    );
    assert.match(
      h1Block[1],
      /line-height:\s*var\(--type-page-title-line-height\);/,
      `${label} h1 must consume --type-page-title-line-height`,
    );
    assert.match(
      featureCss,
      /\.table\s*\{[^}]*font-size:\s*var\(--type-table-cell-size\);/s,
      `${label} table must consume --type-table-cell-size`,
    );
  }

  assert.match(
    files.customers,
    /\.table td\.actionCell\s*\{[^}]*padding-block:\s*var\(--space-1\);/s,
    "Customer actionCell must use 4px block padding to preserve ~44.5px row density",
  );
  assert.match(
    files.customers,
    /\.searchInput\s*\{[^}]*padding-left:\s*calc\([^;]*--icon-control-default/s,
    "Customer searchInput must derive padding-left from --icon-control-default",
  );
  assert.match(
    files.carrier,
    /\.search input\s*\{[^}]*padding-left:\s*calc\([^;]*--icon-control-default/s,
    "Carrier search input must derive padding-left from --icon-control-default",
  );
}

test("canonical design system tokens enforce 36/40/48px controls, 16/18/20px icons, 14/14/16px fonts, typography hierarchy, and 12px table density", () => {
  assertDesignSystemContracts(readDesignSystemSources());
});

test("mutation sensitivity: design system checks fail closed on token/cascade/table regressions", () => {
  const base = readDesignSystemSources();

  assert.throws(() =>
    assertDesignSystemContracts({
      ...base,
      controls: base.controls.replace(
        /(\.size\[data-size="medium"\][^}]*--_control-font-size:\s*)var\(--control-font-size-medium\)/s,
        "$1var(--control-font-size-large)",
      ),
    }),
  );
  assert.throws(() =>
    assertDesignSystemContracts({
      ...base,
      selectButton: base.selectButton.replace(
        /\.segmentedItem\s*\{/,
        ".segmentedItem {\n  font-size: var(--font-size-xs);",
      ),
    }),
  );
  assert.throws(() =>
    assertDesignSystemContracts({
      ...base,
      controls: base.controls.replace(
        /\.textarea:not\(\[rows="1"\]\):not\(\[rows="2"\]\)/,
        ".textarea",
      ),
    }),
  );
  assert.throws(() =>
    assertDesignSystemContracts({
      ...base,
      tokens: base.tokens.replace(
        /--type-table-cell-size:\s*var\(--font-size-sm\);/,
        "--type-table-cell-size: var(--font-size-base);",
      ),
    }),
  );
  assert.throws(() =>
    assertDesignSystemContracts({
      ...base,
      customers: base.customers.replace(
        /padding-block:\s*var\(--space-1\);/,
        "",
      ),
    }),
  );
});
