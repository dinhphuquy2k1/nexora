import { RuleTester, ESLint } from "eslint";
import ts from "typescript-eslint";
import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import rule from "./readable-raw-sql.mjs";

const filename = resolve(
  "apps/api/src/shipment/infrastructure/lint-example.ts",
);

RuleTester.describe = describe;
RuleTester.it = it;

new RuleTester({ languageOptions: { parser: ts.parser } }).run(
  "readable-raw-sql",
  rule,
  {
    valid: [
      {
        code: "await db.$queryRaw`SELECT 1`;",
        filename,
      },
      {
        code: `await tx.$queryRaw\`
          SELECT id
          FROM users
          WHERE id = \${id}::uuid
          FOR UPDATE
        \`;`,
        filename,
      },
      {
        code: `const q = Prisma.sql\`
          UPDATE sync_jobs
          SET status = \${status}
          WHERE id = \${id}::uuid
          RETURNING id
        \`;`,
        filename,
      },
      {
        code: `const q = Prisma.sql\`
          SELECT id
          FROM shipments
          WHERE \${where}
            AND provider IS DISTINCT FROM \${provider}
        \`;`,
        filename,
      },
    ],
    invalid: [
      {
        code: "await tx.$queryRaw`SELECT id FROM users WHERE id = ${id}::uuid FOR UPDATE`;",
        filename,
        errors: [{ messageId: "multipleClausesOnLine" }],
      },
      {
        code: `const q = Prisma.sql\`UPDATE sync_jobs SET status = \${status} WHERE id = \${id}::uuid\`;`,
        filename,
        errors: [{ messageId: "multipleClausesOnLine" }],
      },
      {
        code: `await tx.$executeRaw\`\n  SELECT ${"a".repeat(120)}\n\`;`,
        filename,
        errors: [{ messageId: "lineTooLong" }],
      },
    ],
  },
);

test("readable-raw-sql is enabled for production source and allows short single-clause SELECT 1", async () => {
  const eslint = new ESLint();
  const [badResult] = await eslint.lintText(
    "export async function q(tx: any, id: string) { return tx.$queryRaw`SELECT id FROM users WHERE id = ${id}`; }",
    { filePath: "apps/api/src/shipment/infrastructure/lint-probe.ts" },
  );
  assert.ok(
    badResult.messages.some(
      (m) => m.ruleId === "nexora/readable-raw-sql" && m.severity === 2,
    ),
  );

  const [goodResult] = await eslint.lintText(
    "export async function q(tx: any) { return tx.$queryRaw`SELECT 1`; }",
    { filePath: "apps/api/src/health/infrastructure/lint-probe.ts" },
  );
  assert.ok(
    !goodResult.messages.some((m) => m.ruleId === "nexora/readable-raw-sql"),
  );
});
