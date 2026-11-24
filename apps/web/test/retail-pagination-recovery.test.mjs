import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import { loadComponent } from "./helpers/render-component.mjs";

// Execute the actual page's effect with explicit read/query snapshots. Existing
// hook and browser regressions separately verify how these snapshots are fenced.
const root = new URL("../features/retail-packages/", import.meta.url);
const source = ts.transpileModule(
  readFileSync(new URL("RetailPackageListPage.tsx", root), "utf8"),
  {
    fileName: "RetailPackageListPage.tsx",
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
function recover({
  totalPages = 4,
  page = 5,
  status = "ready",
  invalid = false,
  draft = "REFRESH",
  responsePage = page,
  responseSize = 20,
  data = true,
} = {}) {
  const calls = [],
    effects = [];
  let state = 0;
  const query = {
    page,
    pageSize: 20,
    search: "REFRESH",
    status: "at_origin",
    filters: [],
  };
  const require = createRequire(import.meta.url);
  const module = { exports: {} };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === "react")
        return {
          useState: (initial) => [state++ === 3 ? draft : initial, () => {}],
          useCallback: (fn) => fn,
          useMemo: (fn) => fn(),
          useRef: (value) => ({ current: value }),
          useEffect: (fn, deps) => {
            if (deps.length) effects.push(fn);
          },
        };
      if (name === "./useRetailQuery.ts")
        return {
          useRetailQuery: () => ({
            query,
            invalid,
            change: (...args) => calls.push(args),
          }),
        };
      if (name === "./useShipmentRead.ts")
        return {
          useShipmentList: () => ({
            status,
            loading: status === "loading",
            refresh() {},
            data: data
              ? {
                  shipments: [],
                  pagination: {
                    page: responsePage,
                    pageSize: responseSize,
                    totalPages,
                    total: 78,
                  },
                  stats: { total: 100 },
                }
              : undefined,
          }),
        };
      if (name.endsWith(".css")) return {};
      if (name.startsWith(".")) return loadComponent(new URL(name, root));
      if (name === "@nexora/ui") return {};
      return require(name);
    },
  });
  module.exports.RetailPackageListPage({ api: {} });
  for (const effect of effects) effect();
  return calls;
}
for (const [totalPages, last] of [
  [4, 4],
  [1, 1],
  [0, 1],
])
  test(`Current ready response recovers page5 to${last}, totalPages=${totalPages}`, () => {
    const calls = recover({ totalPages });
    assert.equal(
      JSON.stringify(calls),
      JSON.stringify([[{ page: last }, { replace: true }]]),
    );
  });
for (const [name, options] of [
  ["valid page", { page: 2 }],
  ["loading retained totals", { status: "loading" }],
  ["failed retained totals", { status: "error" }],
  ["unsupported query", { status: "idle" }],
  ["invalid URL", { invalid: true }],
  ["pending search", { draft: "uncommitted" }],
  ["old query page", { responsePage: 4 }],
  ["old query size", { responseSize: 10 }],
  ["fenced query/API/session without data", { data: false }],
])
  test(`Pagination does not navigate from ${name}`, () =>
    assert.equal(recover(options).length, 0));
