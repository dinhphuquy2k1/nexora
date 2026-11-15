import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import loader from "./typescript-loader.cjs";

test("fixture compiler parses generic arrows in .ts as callable functions", async () => {
  const output = loader.call(
    { resourcePath: "/fixture/watch.ts" },
    "const watch = <T>(x: Promise<T>) => x; export { watch };",
  );
  const { watch } = await import(
    `data:text/javascript,${encodeURIComponent(output)}`
  );
  assert.equal(typeof watch, "function");
  assert.equal(await watch(Promise.resolve(42)), 42);
});

test("fixture compiler compiles .tsx JSX with the existing React runtime", async () => {
  const output = loader.call(
    { resourcePath: "/fixture/view.tsx" },
    'export const view = <div title="fixture">Hello</div>;',
  );
  assert.match(output, /react\/jsx-runtime/);
  assert.match(output, /_jsx\("div",/);
  assert.doesNotMatch(output, /<div/);
  const require = createRequire(
    new URL("../../../apps/web/package.json", import.meta.url),
  );
  const runtime = pathToFileURL(require.resolve("react/jsx-runtime")).href;
  const executable = output.replace(
    '"react/jsx-runtime"',
    JSON.stringify(runtime),
  );
  const { view } = await import(
    `data:text/javascript,${encodeURIComponent(executable)}`
  );
  assert.equal(view.type, "div");
  assert.equal(view.props.title, "fixture");
  assert.equal(view.props.children, "Hello");
});

test("fixture compiler rejects syntax errors with file and diagnostic information", () => {
  assert.throws(
    () =>
      loader.call({ resourcePath: "/fixture/broken.ts" }, "const broken = ;"),
    /broken\.ts\(1,16\): error TS1109: Expression expected/,
  );
});
