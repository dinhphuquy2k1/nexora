import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  API_DEV_PASSTHROUGH_ENV,
  IDENTITY_ENV,
  CARRIER_UNISHIP_ENV,
  TSC_WATCH_ENV,
  EXISTING_GLOBAL_ENV,
} from "./helpers/runtime-environment-contract.mjs";
const sorted = (values) => [...(values ?? [])].sort();
test("static Turbo runtime custody is API-dev scoped, strict and preserves baseline tasks", () => {
  const config = JSON.parse(readFileSync("turbo.json", "utf8"));
  assert.deepEqual(
    sorted(config.tasks["@nexora/api#dev"].passThroughEnv),
    sorted(API_DEV_PASSTHROUGH_ENV),
  );
  for (const name of ["@nexora/shared#dev", "@nexora/database#dev"])
    assert.deepEqual(
      sorted(config.tasks[name].passThroughEnv),
      sorted(TSC_WATCH_ENV),
    );
  assert.deepEqual(config.tasks.dev, { cache: false, persistent: true });
  assert.deepEqual(config.tasks["@nexora/database#build"], {
    cache: false,
    outputs: ["dist/**"],
  });
  assert.deepEqual(config.tasks.build, {
    dependsOn: ["^build"],
    outputs: ["dist/**", ".next/**", "!.next/cache/**"],
  });
  assert.deepEqual(config.tasks.typecheck, { dependsOn: ["build"] });
  assert.deepEqual(config.tasks.test, { dependsOn: ["build"], cache: false });
  assert.deepEqual(config.globalEnv, EXISTING_GLOBAL_ENV);
  assert.equal(config.globalPassThroughEnv, undefined);
  for (const [name, task] of Object.entries(config.tasks)) {
    for (const value of [...(task.passThroughEnv ?? []), ...(task.env ?? [])]) {
      assert.ok(!value.includes("*"), "No broad task environment wildcard");
      if (name !== "@nexora/api#dev")
        assert.ok(
          ![...IDENTITY_ENV, ...CARRIER_UNISHIP_ENV].includes(value),
          "No credentials on unrelated task",
        );
    }
    if (name.endsWith("#dev")) {
      assert.equal(task.cache, false);
      assert.equal(task.persistent, true);
    }
  }
});
test("resolved strict Turbo dev retains exact task/global environment contracts", () => {
  const fixture = Object.fromEntries(
    API_DEV_PASSTHROUGH_ENV.map((key) => [key, `synthetic-${key}`]),
  );
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "turbo",
      "run",
      "dev",
      "--filter=@nexora/api",
      "--filter=@nexora/shared",
      "--filter=@nexora/database",
      "--dry=json",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, ...fixture },
      maxBuffer: 4 * 1024 * 1024,
    },
  );
  assert.equal(result.status, 0, "Turbo dry run must succeed");
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.envMode, "strict");
  assert.deepEqual(resolved.tasks.map((task) => task.taskId).sort(), [
    "@nexora/api#dev",
    "@nexora/database#dev",
    "@nexora/shared#dev",
  ]);
  const global = resolved.globalCacheInputs.environmentVariables.specified;
  assert.deepEqual(sorted(global.env), sorted(EXISTING_GLOBAL_ENV));
  assert.deepEqual(global.passThroughEnv ?? [], []);
  for (const task of resolved.tasks) {
    const expected =
      task.taskId === "@nexora/api#dev"
        ? API_DEV_PASSTHROUGH_ENV
        : TSC_WATCH_ENV;
    assert.deepEqual(
      sorted(task.resolvedTaskDefinition.passThroughEnv),
      sorted(expected),
      `task-scoped allowlist: ${task.taskId}`,
    );
    assert.equal(task.envMode, "strict");
    assert.equal(task.resolvedTaskDefinition.cache, false);
    assert.equal(task.resolvedTaskDefinition.persistent, true);
  }
});
