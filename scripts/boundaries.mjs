import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const under = (path, root) => path === root || path.startsWith(root + "/");

function imports(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const specs = [];
  function visit(node) {
    let value;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      value = node.moduleSpecifier;
    else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    )
      value = node.moduleReference.expression;
    else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    )
      value = node.arguments[0];
    if (value && ts.isStringLiteralLike(value)) specs.push(value.text);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return specs;
}

export function checkFileImports(p, content) {
  for (const spec of imports(p, content)) {
    const target = spec.startsWith(".") ? resolve(dirname(p), spec) : null;
    if (
      p.startsWith("packages/sdk/") &&
      (spec === "@nexora/api" ||
        spec.startsWith("@nexora/api/") ||
        (target && under(target, resolve("apps/api"))))
    )
      throw Error(`SDK boundary: ${p}`);
    for (const app of ["api", "web"])
      if (
        (spec === `@nexora/${app}` ||
          spec.startsWith(`@nexora/${app}/`) ||
          (target && under(target, resolve(`apps/${app}`)))) &&
        !p.startsWith(`apps/${app}/`)
      )
        throw Error(`App import: ${p}`);
    const database =
      /^@nexora\/database(?:\/|$)|^@prisma\//.test(spec) ||
      (target && under(target, resolve("packages/database")));
    if (p.startsWith("apps/web/") && database)
      throw Error(`Web boundary: ${p}`);
    if (
      p.startsWith("apps/api/") &&
      database &&
      !p.includes("/infrastructure/")
    )
      throw Error(`Prisma boundary: ${p}`);
  }
}

export function runNegativeTests() {
  assert.throws(
    () => checkFileImports("apps/web/test.ts", "import '@nexora/database';"),
    /Web boundary/,
  );
  assert.throws(
    () =>
      checkFileImports(
        "apps/api/src/health/application/service.ts",
        "import '@nexora/database';",
      ),
    /Prisma boundary/,
  );
  assert.throws(
    () => checkFileImports("apps/api/src/main.ts", "import '@nexora/web';"),
    /App import/,
  );
  assert.throws(
    () =>
      checkFileImports("packages/sdk/src/index.ts", "import '@nexora/api';"),
    /SDK boundary/,
  );
}

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (
      ["node_modules", "dist", ".next", ".turbo", ".contracts"].includes(e.name)
    )
      continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) await walk(p);
    else if (/\.(ts|tsx)$/.test(p)) {
      checkFileImports(p, await readFile(p, "utf8"));
    }
  }
}

runNegativeTests();
await walk("apps");
await walk("packages");
console.log("Workspace boundaries PASS");
