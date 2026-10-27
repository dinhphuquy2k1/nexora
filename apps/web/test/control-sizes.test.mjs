import test from "node:test";
import assert from "node:assert/strict";
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
