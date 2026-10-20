import { ESLint } from "eslint";
import { test } from "node:test";
import assert from "node:assert/strict";

const eslint = new ESLint();
test("Customer production rejects nested ternaries in either arm", async () => {
  for (const expression of ["a ? b : c ? d : e", "a ? b ? c : d : e"]) {
    const [result] = await eslint.lintText(
      `export const value = ${expression};`,
      {
        filePath: "apps/api/src/customer/application/lint-example.ts",
      },
    );
    assert.ok(
      result.messages.some(
        (m) => m.ruleId === "no-nested-ternary" && m.severity === 2,
      ),
    );
  }
});
test("Customer allows single ternaries and explicit branches; unrelated/generated scope unchanged", async () => {
  const [result] = await eslint.lintText("export const value = true ? 1 : 2;", {
    filePath: "apps/api/src/customer/domain/lint-example.ts",
  });
  assert.ok(!result.messages.some((m) => m.ruleId === "no-nested-ternary"));
  for (const path of [
    "apps/api/src/identity/application/example.ts",
    "packages/sdk/src/generated/api.ts",
  ]) {
    const config = await eslint.calculateConfigForFile(path);
    assert.notEqual(config?.rules?.["no-nested-ternary"]?.[0], 2);
  }
});
