import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
export function verifyUnishipComposeEnvironment() {
  const dir = mkdtempSync(join(tmpdir(), "nexora-env-contract-"));
  const envFile = join(dir, "fixture.env");
  const baseEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    PUBLIC_ORIGIN: "https://fixture.invalid",
    PUBLIC_FQDN: "fixture.invalid",
    ALLOWED_HOSTS: "fixture.invalid",
    ALLOWED_ORIGINS: "https://fixture.invalid",
  };
  try {
    for (const files of [
      ["compose.yml"],
      ["compose.yml", "compose.dev.yml"],
      ["compose.release.yml"],
      ["compose.yml", "compose.public.yml"],
    ]) {
      for (const values of [
        {},
        Object.fromEntries(sync.map((key) => [key, ""])),
        {
          SYNC_ENABLED: "true",
          SYNC_LEASE_SECONDS: "120",
          SYNC_POLL_MS: "250",
          SYNC_MAX_ATTEMPTS: "7",
          SYNC_RESOLVED_RETENTION_DAYS: "30",
        },
        {
          SYNC_ENABLED: "invalid",
          SYNC_LEASE_SECONDS: "-1",
          SYNC_POLL_MS: "x",
          SYNC_MAX_ATTEMPTS: "0",
          SYNC_RESOLVED_RETENTION_DAYS: "-1",
        },
      ]) {
        writeFileSync(
          envFile,
          Object.entries({
            ...Object.fromEntries(shared.map((key) => [key, fixture[key]])),
            ...values,
          })
            .map(([key, value]) => `${key}=${value}`)
            .join("\n"),
          { mode: 0o600 },
        );
        const result = spawnSync(
          "docker",
          [
            "compose",
            "--env-file",
            envFile,
            ...files.flatMap((file) => ["-f", file]),
            "config",
            "--format",
            "json",
          ],
          { encoding: "utf8", env: baseEnv, maxBuffer: 4 * 1024 * 1024 },
        );
        assert.equal(result.status, 0, `Compose resolves ${files.join("+")}`);
        const config = JSON.parse(result.stdout);
        for (const key of [...shared, ...sync]) {
          const expected =
            values[key] ||
            ({
              SYNC_ENABLED: "false",
              SYNC_LEASE_SECONDS: "60",
              SYNC_POLL_MS: "1000",
              SYNC_MAX_ATTEMPTS: "5",
              SYNC_RESOLVED_RETENTION_DAYS: "",
            }[key] ??
              fixture[key]);
          assert.equal(
            config.services.api.environment[key],
            expected,
            `API ${key}`,
          );
          assert.equal(
            config.services["sync-worker"].environment[key],
            expected,
            `Worker ${key}`,
          );
        }
        for (const key of [
          "IDENTITY_KEYRING_JSON",
          "IDENTITY_ACTIVE_KEY_VERSION",
        ])
          assert.equal(
            config.services["sync-worker"].environment[key],
            undefined,
          );
        for (const key of shared)
          assert.equal(config.services.web.environment[key], undefined);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
