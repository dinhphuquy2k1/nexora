import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function validateExpressions(source) {
  const file = ts.createSourceFile(
    "browser.mjs",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  let count = 0;
  function walk(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      ["evaluate", "until"].includes(node.expression.text)
    ) {
      const argument = node.arguments[0];
      if (
        argument &&
        (ts.isStringLiteral(argument) ||
          ts.isNoSubstitutionTemplateLiteral(argument))
      ) {
        new AsyncFunction(argument.text);
        count++;
      }
    }
    ts.forEachChild(node, walk);
  }
  walk(file);
  return count;
}
test("static CDP expressions are valid JavaScript before a genuine browser run", async () => {
  let count = 0;
  for (const name of ["customer-browser-checks.mjs", "customer-read-races.mjs"])
    count += validateExpressions(
      await readFile(new URL(name, import.meta.url), "utf8"),
    );
  assert.ok(count > 20);
  assert.throws(
    () =>
      validateExpressions(
        `evaluate('document.querySelector("a[href="/settings"]").click()')`,
      ),
    SyntaxError,
  );
});

test("readiness predicates return serializable booleans even when matching DOM nodes have React cycles", async () => {
  const { runInNewContext } = await import("node:vm");
  const { customerPredicate } = await import("./customer-browser-checks.mjs");
  const node = { getClientRects: () => [{}], textContent: "Fixture" };
  node.reactFiber = { stateNode: node };
  const context = { document: { querySelectorAll: () => [node] } };
  const expression = `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Fixture')`;
  assert.throws(
    () => JSON.stringify(runInNewContext(expression, context)),
    TypeError,
  );
  assert.equal(
    JSON.stringify(runInNewContext(customerPredicate(expression), context)),
    "true",
  );
  assert.equal(
    runInNewContext(customerPredicate(expression), {
      document: { querySelectorAll: () => [] },
    }),
    false,
  );
});
