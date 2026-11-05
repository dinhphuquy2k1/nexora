import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { setTimeout, clearTimeout } from "node:timers";
// Execute the actual component closures with deterministic hooks and controlled I/O.
// Child markup is opaque here; actual browser geometry remains in the CDP suite.
export function componentHarness(file, dependencies) {
  const slots = [],
    effects = [];
  let cursor = 0,
    writes = 0;
  const effectSlots = new Set();
  const changed = (previous, next) =>
    !previous || next.some((value, i) => value !== previous[i]);
  const hooks = {
    useRef(value) {
      const i = cursor++;
      return (slots[i] ??= { current: value });
    },
    useState(value) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof value === "function" ? value() : value;
      return [
        slots[i],
        (next) => {
          writes++;
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useId() {
      return "fixture-id";
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { fn, deps };
      return slots[i].fn;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      effectSlots.add(i);
      if (changed(slots[i]?.deps, deps)) {
        const previous = slots[i];
        slots[i] = { deps };
        effects.push(() => {
          previous?.cleanup?.();
          slots[i].cleanup = fn();
        });
      }
    },
  };
  const module = { exports: {} };
  const code = ts.transpileModule(
    readFileSync(
      file instanceof URL
        ? file
        : new URL(file, new URL("../", import.meta.url)),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    AbortController: globalThis.AbortController,
    AbortSignal: globalThis.AbortSignal,
    setTimeout,
    clearTimeout,
    require(name) {
      if (name === "react") return hooks;
      if (name === "react/jsx-runtime")
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      if (name.endsWith(".css")) return { default: {} };
      if (name in dependencies) return dependencies[name];
      throw Error("Unexpected component dependency: " + name);
    },
  });
  return {
    get writes() {
      return writes;
    },
    unmount() {
      for (const i of effectSlots) slots[i]?.cleanup?.();
    },
    render(props) {
      cursor = 0;
      const result = Object.values(module.exports)[0](props);
      for (const effect of effects.splice(0)) effect();
      return result;
    },
  };
}
