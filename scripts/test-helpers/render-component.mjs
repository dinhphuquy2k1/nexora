import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import vm from "node:vm";
import { setTimeout, clearTimeout } from "node:timers";
import { URLSearchParams, fileURLToPath } from "node:url";
import ts from "typescript";

const candidatePackages = [
  new URL("../../apps/web/package.json", import.meta.url),
  new URL("../../packages/ui/package.json", import.meta.url),
  new URL("../../package.json", import.meta.url),
];
let require;
for (const cand of candidatePackages) {
  try {
    const req = createRequire(cand);
    req.resolve("react");
    req.resolve("react-dom/server");
    require = req;
    break;
  } catch {
    // continue fallback
  }
}
if (!require) {
  require = createRequire(candidatePackages[0]);
}

function normalizePath(target) {
  if (!target) return target;
  if (target instanceof URL) return fileURLToPath(target);
  if (typeof target === "string") {
    if (target.startsWith("file:")) return fileURLToPath(target);
    if (/^\/[A-Za-z]:[\\/]/.test(target)) return target.slice(1);
  }
  return target;
}

/** Execute actual local TSX for native SSR assertions; CSS modules supply class identities only. */
export function loadComponent(rawFilename, cache = new Map()) {
  const filename = normalizePath(rawFilename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const localRequire = (name) => {
    if (name.endsWith(".css"))
      return new Proxy(
        {},
        { get: (_, key) => (key === "__esModule" ? false : String(key)) },
      );
    let file;
    if (name === "@nexora/ui")
      file = fileURLToPath(
        new URL("../../packages/ui/src/index.tsx", import.meta.url),
      );
    else if (name.startsWith(".")) file = resolve(dirname(filename), name);
    if (file) {
      if (!existsSync(file))
        file = [".tsx", ".ts", ".mjs", ".js"]
          .map((ext) => file + ext)
          .find(existsSync);
      if (!file) throw Error("Missing test source dependency");
      return loadComponent(file, cache);
    }
    return require(name);
  };
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: localRequire,
    console,
    process,
    setTimeout,
    clearTimeout,
    URLSearchParams,
  });
  return module.exports;
}
export const React = require("react");
export const render = require("react-dom/server").renderToStaticMarkup;
