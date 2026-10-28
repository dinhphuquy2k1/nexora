import { builtinModules } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import assert from "node:assert/strict";
import ts from "typescript";

const under = (path, root) => {
  const normPath = path.replace(/\\/g, "/");
  const normRoot = root.replace(/\\/g, "/");
  return normPath === normRoot || normPath.startsWith(normRoot + "/");
};

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
    const target = spec.startsWith(".")
      ? resolve(dirname(p), spec).replace(/\\/g, "/")
      : null;
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
    // Domain-approved shared validation must not gain dependencies on UI,
    // deployment policies, other package modules, or third-party runtimes.
    // Every validation source is visited by the repository walk below.
    if (
      p.startsWith("packages/shared/src/validation/") &&
      (!spec.startsWith(".") ||
        !target ||
        !under(target, resolve("packages/shared/src/validation")))
    )
      throw Error(`Shared validation purity boundary: ${p}`);
    if (
      p.startsWith("packages/shared/") &&
      (builtinModules.includes(spec) ||
        /^(?:node:|@nestjs\/|@prisma\/|@nexora\/(?:database|sdk)(?:\/|$))/.test(
          spec,
        ) ||
        (target && under(target, resolve("packages/database"))))
    )
      throw Error(`Shared browser boundary: ${p}`);
    const apiDomain = /^apps\/api\/src\/[^/]+\/domain\//.test(p);
    const targetLayer =
      target &&
      /\/apps\/api\/src\/[^/]+\/(application|infrastructure|presentation)(?:\/|$)/.test(
        target,
      );
    if (
      apiDomain &&
      (/^@nestjs\/|^(?:@types\/)?express(?:\/|$)|^(?:node:)?https?$/.test(
        spec,
      ) ||
        targetLayer ||
        spec === "@nexora/shared" ||
        (spec.startsWith("@nexora/shared/") &&
          spec !== "@nexora/shared/customer-status" &&
          spec !== "@nexora/shared/validation") ||
        spec.includes("customer-status-labels") ||
        (target &&
          under(target, resolve("packages/shared")) &&
          !target.endsWith("/customer-status")))
    )
      throw Error(`Domain purity boundary: ${p}`);
    if (
      /^apps\/api\/src\/[^/]+\/application\//.test(p) &&
      target &&
      /\/apps\/api\/src\/[^/]+\/(infrastructure|presentation)(?:\/|$)/.test(
        target,
      )
    )
      throw Error(`Application dependency boundary: ${p}`);
    if (
      /^apps\/api\/src\/[^/]+\/presentation\//.test(p) &&
      target &&
      /\/apps\/api\/src\/[^/]+\/infrastructure(?:\/|$)/.test(target)
    )
      throw Error(`Controller adapter boundary: ${p}`);
  }
}

export function runNegativeTests() {
  checkFileImports(
    "apps/web/test.ts",
    "import { CustomerStatus } from '@nexora/shared';",
  );
  checkFileImports(
    "apps/api/src/customer/domain/example.ts",
    "import { CustomerStatus } from '@nexora/shared/customer-status';",
  );
  checkFileImports(
    "apps/api/src/customer/domain/example.ts",
    "import { normalizeBoundedText } from '@nexora/shared/validation';",
  );
  checkFileImports(
    "packages/shared/src/validation/index.ts",
    "export { parsePagination } from './pagination';",
  );
  for (const spec of [
    "../deployment",
    "../../customer-status-labels",
    "@nexora/ui",
    "zod",
    "node:crypto",
    "@nexora/shared/customer-status",
  ])
    assert.throws(
      () =>
        checkFileImports(
          "packages/shared/src/validation/index.ts",
          `export * from '${spec}';`,
        ),
      /Shared validation purity boundary/,
    );
  for (const spec of [
    "@nexora/shared",
    "@nexora/shared/customer-status-labels",
    "../../../../../packages/shared/src/customer-status-labels",
  ])
    assert.throws(
      () =>
        checkFileImports(
          "apps/api/src/customer/domain/example.ts",
          `import '${spec}';`,
        ),
      /Domain purity boundary/,
    );
  assert.throws(
    () =>
      checkFileImports(
        "apps/web/test.ts",
        "import '../api/src/customer/domain/customer';",
      ),
    /App import/,
  );
  for (const spec of [
    "@nestjs/common",
    "@prisma/client",
    "@nexora/database",
    "node:crypto",
  ])
    assert.throws(
      () =>
        checkFileImports("packages/shared/src/test.ts", `import '${spec}';`),
      /Shared browser boundary/,
    );
  assert.throws(
    () =>
      checkFileImports(
        "packages/shared/src/test.ts",
        "import '../../../apps/api/src/customer/domain/customer';",
      ),
    /App import/,
  );
  for (const layer of [
    "infrastructure/customer.adapter",
    "presentation/customer.dto",
  ])
    assert.throws(
      () =>
        checkFileImports(
          "apps/api/src/customer/application/example.ts",
          `import '../${layer}';`,
        ),
      /Application dependency boundary/,
    );
  for (const spec of [
    "@nestjs/common",
    "express",
    "node:http",
    "../application/customer.input",
    "../infrastructure/customer.adapter",
    "../presentation/customer.dto",
    "../../identity/application/auth.service",
  ]) {
    assert.throws(
      () =>
        checkFileImports(
          "apps/api/src/customer/domain/example.ts",
          `import '${spec}';`,
        ),
      /Domain purity boundary/,
    );
  }
  assert.throws(
    () =>
      checkFileImports(
        "apps/api/src/customer/presentation/example.ts",
        "import '../infrastructure/customer.adapter';",
      ),
    /Controller adapter boundary/,
  );
  checkFileImports(
    "apps/api/src/customer/domain/example.ts",
    "import './customer'; import 'libphonenumber-js/max';",
  );
  checkFileImports(
    "apps/api/src/customer/application/example.ts",
    "import '@nestjs/common'; import '../domain/customer';",
  );
  checkFileImports(
    "apps/api/src/customer/infrastructure/example.ts",
    "import '@nexora/database'; import '../application/customer.port';",
  );
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
  assert.throws(
    () => checkDockerManifestDeclarationsContent("FROM tools\n", ["apps/api"]),
    /Missing Dockerfile manifest declaration/,
  );
  assert.throws(
    () =>
      checkDockerManifestDeclarationsContent(
        "COPY apps/api/package.json apps/api/package.json\nCOPY apps/stale/package.json apps/stale/package.json",
        ["apps/api"],
      ),
    /Stale Dockerfile manifest declaration/,
  );
  assert.throws(
    () =>
      checkDockerManifestDeclarationsContent(
        "# COPY apps/api/package.json apps/api/package.json\n",
        ["apps/api"],
      ),
    /Missing Dockerfile manifest declaration/,
  );
  // Positive test: valid declarations pass without error
  checkDockerManifestDeclarationsContent(
    "COPY apps/api/package.json apps/api/package.json\nCOPY apps/web/package.json apps/web/package.json",
    ["apps/api", "apps/web"],
  );
}

const sharedGraph = new Map();
const customerStatusDeclarations = [];
export function assertAcyclic(graph) {
  const visiting = new Set(),
    visited = new Set();
  function visit(node) {
    if (visiting.has(node)) throw Error(`Shared dependency cycle: ${node}`);
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dependency of graph.get(node) ?? []) visit(dependency);
    visiting.delete(node);
    visited.add(node);
  }
  for (const node of graph.keys()) visit(node);
}
assert.throws(
  () =>
    assertAcyclic(
      new Map([
        ["a", ["b"]],
        ["b", ["a"]],
      ]),
    ),
  /Shared dependency cycle/,
);
assertAcyclic(
  new Map([
    ["labels", ["codes"]],
    ["codes", []],
  ]),
);

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (
      ["node_modules", "dist", ".next", ".turbo", ".contracts"].includes(e.name)
    )
      continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) await walk(p);
    else if (/\.(ts|tsx)$/.test(p)) {
      const content = await readFile(p, "utf8");
      if (content.includes("CustomerStatus")) {
        const source = ts.createSourceFile(
          p,
          content,
          ts.ScriptTarget.Latest,
          true,
        );
        for (const statement of source.statements)
          if (ts.isVariableStatement(statement))
            for (const declaration of statement.declarationList.declarations)
              if (declaration.name.getText(source) === "CustomerStatus")
                customerStatusDeclarations.push(p);
      }
      checkFileImports(p, content);
      if (p.startsWith("packages/shared/src/"))
        sharedGraph.set(
          resolve(p).replace(/\.tsx?$/, ""),
          imports(p, content)
            .filter((spec) => spec.startsWith("."))
            .map((spec) => resolve(dirname(p), spec).replace(/\.tsx?$/, "")),
        );
    }
  }
}

export function parseDeclaredManifestCopies(dockerfileText) {
  const declared = new Set();
  const lines = dockerfileText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^COPY\s+([^\s]+)\s+([^\s]+)$/);
    if (match) {
      const [, src, dest] = match;
      if (
        src.endsWith("/package.json") &&
        (src.startsWith("apps/") || src.startsWith("packages/"))
      ) {
        if (src !== dest) {
          throw new Error(
            `Asymmetric manifest COPY declaration: '${src}' vs '${dest}'`,
          );
        }
        const pkgDir = src.slice(0, -"/package.json".length);
        declared.add(pkgDir);
      }
    }
  }
  return declared;
}

export function checkDockerManifestDeclarationsContent(
  toolsDockerfile,
  actualPackages = [
    "apps/api",
    "apps/web",
    "packages/database",
    "packages/sdk",
    "packages/shared",
    "packages/ui",
  ],
) {
  const actualSet = new Set(actualPackages);
  const declaredSet = parseDeclaredManifestCopies(toolsDockerfile);

  // Direction 1: Every actual workspace package must have a COPY declaration
  for (const pkg of actualSet) {
    if (!declaredSet.has(pkg)) {
      throw new Error(
        `Missing Dockerfile manifest declaration: expected 'COPY ${pkg}/package.json ${pkg}/package.json' in docker/Dockerfile.tools`,
      );
    }
  }

  // Direction 2: Every declared manifest COPY must correspond to an actual workspace package
  for (const declared of declaredSet) {
    if (!actualSet.has(declared)) {
      throw new Error(
        `Stale Dockerfile manifest declaration: package '${declared}' declared in docker/Dockerfile.tools does not exist in workspace`,
      );
    }
  }
}

export async function discoverWorkspacePackages() {
  const workspaceFile = await readFile("pnpm-workspace.yaml", "utf8");
  const packages = [];
  const lines = workspaceFile.split(/\r?\n/);
  for (const line of lines) {
    const match = line.trim().match(/^-\s*['"]?([^/'"]+)\/\*['"]?$/);
    if (match) {
      const group = match[1];
      try {
        const entries = await readdir(group, { withFileTypes: true });
        for (const ent of entries) {
          if (ent.isDirectory()) {
            const pkgPath = `${group}/${ent.name}`;
            try {
              // Ensure package.json actually exists inside this directory
              await readFile(`${pkgPath}/package.json`, "utf8");
              packages.push(pkgPath);
            } catch {
              // Non-package directory (e.g. without package.json) is ignored
            }
          }
        }
      } catch {
        // Directory group does not exist
      }
    }
  }
  return packages.sort();
}

export async function checkDockerManifestDeclarations() {
  const toolsDockerfile = await readFile("docker/Dockerfile.tools", "utf8");
  const actualPackages = await discoverWorkspacePackages();
  checkDockerManifestDeclarationsContent(toolsDockerfile, actualPackages);
}

runNegativeTests();
await checkDockerManifestDeclarations();
await walk("apps");
await walk("packages");
assertAcyclic(sharedGraph);
assert.deepEqual(
  customerStatusDeclarations,
  ["packages/shared/src/customer-status.ts"],
  "CustomerStatus must have exactly one canonical runtime declaration",
);
console.log("Workspace boundaries PASS");
