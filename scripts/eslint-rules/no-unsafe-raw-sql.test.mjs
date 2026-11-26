import { RuleTester, ESLint } from "eslint";
import ts from "typescript-eslint";
import { test, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import rule from "./no-unsafe-raw-sql.mjs";

const filename = resolve("apps/api/src/sync/infrastructure/lint-example.ts");

RuleTester.describe = describe;
RuleTester.it = it;

new RuleTester({ languageOptions: { parser: ts.parser } }).run(
  "no-unsafe-raw-sql",
  rule,
  {
    valid: [
      {
        code: "await tx.$queryRaw`SELECT 1`;",
        filename,
      },
      {
        code: "await tx.$executeRaw(Prisma.sql`SELECT 1`);",
        filename,
      },
    ],
    invalid: [
      {
        code: 'await tx.$queryRawUnsafe("SELECT 1");',
        filename,
        errors: [
          { messageId: "unsafeRawSql", data: { method: "$queryRawUnsafe" } },
        ],
      },
      {
        code: 'await this.db.$executeRawUnsafe("DELETE FROM sync_jobs");',
        filename,
        errors: [
          { messageId: "unsafeRawSql", data: { method: "$executeRawUnsafe" } },
        ],
      },
      {
        code: "await tx.$queryRawUnsafe`SELECT 1`;",
        filename,
        errors: [
          { messageId: "unsafeRawSql", data: { method: "$queryRawUnsafe" } },
        ],
      },
    ],
  },
);

test("no-unsafe-raw-sql is enabled for apps/**/src and packages/**/src but not tests", async () => {
  const eslint = new ESLint();
  const [prodResult] = await eslint.lintText(
    'export async function bad(tx: any) { return tx.$queryRawUnsafe("SELECT 1"); }',
    { filePath: "apps/api/src/sync/infrastructure/lint-probe.ts" },
  );
  assert.ok(
    prodResult.messages.some(
      (m) => m.ruleId === "nexora/no-unsafe-raw-sql" && m.severity === 2,
    ),
  );

  const testConfig = await eslint.calculateConfigForFile(
    "apps/api/src/sync/infrastructure/lint-probe.test.ts",
  );
  assert.notEqual(testConfig?.rules?.["nexora/no-unsafe-raw-sql"]?.[0], 2);
});
