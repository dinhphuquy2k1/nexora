import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const shared = [
  "CARRIER_KEYRING_JSON",
  "CARRIER_ACTIVE_KEY_VERSION",
  "UNISHIP_API_URL",
  "UNISHIP_LIVE_AUTHORIZED",
  "UNISHIP_ACTIVATION_POLICY_JSON",
  "UNISHIP_RECONCILIATION_POLICY_JSON",
];
const sync = [
  "SYNC_ENABLED",
  "SYNC_LEASE_SECONDS",
  "SYNC_POLL_MS",
  "SYNC_MAX_ATTEMPTS",
  "SYNC_RESOLVED_RETENTION_DAYS",
];
const watch = ["TSC_WATCHFILE", "TSC_WATCHDIRECTORY"];
const fixture = Object.fromEntries(
  [...shared, ...sync, ...watch].map((key) => [key, `synthetic-${key}`]),
);
test("resolved strict Turbo dev grants runtime ENV only to API and watch ENV to dependencies", () => {
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
  for (const task of resolved.tasks) {
    const expected =
      task.taskId === "@nexora/api#dev"
        ? [...shared, ...sync, ...watch]
        : watch;
    assert.deepEqual(
      [...(task.resolvedTaskDefinition.passThroughEnv ?? [])].sort(),
      [...expected].sort(),
      `task-scoped allowlist: ${task.taskId}`,
    );
    assert.equal(task.resolvedTaskDefinition.cache, false);
    assert.equal(task.resolvedTaskDefinition.persistent, true);
  }
});
