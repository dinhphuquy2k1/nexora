import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CARRIER_UNISHIP_ENV,
  SYNC_ENV,
  IDENTITY_ENV,
  SYNC_COMPOSE_DEFAULTS,
} from "./helpers/runtime-environment-contract.mjs";
export function verifyRuntimeComposeEnvironment() {
  const dir = mkdtempSync(join(tmpdir(), "nexora-env-contract-")),
    envFile = join(dir, "fixture.env");
  const parent = { PATH: process.env.PATH, HOME: process.env.HOME };
  const fixture = {
    ...Object.fromEntries(
      CARRIER_UNISHIP_ENV.map((key) => [key, `synthetic-${key}`]),
    ),
    IDENTITY_KEYRING_JSON: JSON.stringify({
      7: Buffer.alloc(32, 13).toString("base64"),
    }),
    IDENTITY_ACTIVE_KEY_VERSION: "7",
  };
  fixture.CARRIER_KEYRING_JSON = JSON.stringify({
    3: Buffer.alloc(32, 11).toString("base64"),
  });
  fixture.CARRIER_ACTIVE_KEY_VERSION = "3";
  const publicValues = {
    PUBLIC_ORIGIN: "https://fixture.invalid",
    PUBLIC_FQDN: "fixture.invalid",
    ALLOWED_HOSTS: "fixture.invalid",
    ALLOWED_ORIGINS: "https://fixture.invalid",
  };
  function resolve(files, values, expectedFailure) {
    writeFileSync(
      envFile,
      Object.entries(values)
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
      { encoding: "utf8", env: parent, maxBuffer: 4 * 1024 * 1024 },
    );
    if (expectedFailure) {
      assert.ok(
        result.status !== 0 && result.stderr.includes(expectedFailure),
        `Required public field ${expectedFailure} fails closed`,
      );
      return;
    }
    assert.ok(result.status === 0, `Compose resolves ${files.join("+")}`);
    return JSON.parse(result.stdout);
  }
  try {
    for (const files of [
      ["compose.yml"],
      ["compose.yml", "compose.dev.yml"],
      ["compose.release.yml"],
      ["compose.yml", "compose.public.yml"],
    ]) {
      const isPublic = files.includes("compose.public.yml");
      for (const sync of [
        {},
        Object.fromEntries(SYNC_ENV.map((key) => [key, ""])),
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
        for (const origin of [
          {},
          { WEB_PORT: "", ALLOWED_ORIGINS: "", ALLOWED_HOSTS: "" },
          {
            WEB_PORT: "127.0.0.1:3112",
            ALLOWED_ORIGINS: "http://127.0.0.1:3112",
            ALLOWED_HOSTS: "localhost,127.0.0.1,nexora-dev.fixture",
          },
        ]) {
          const values = {
            ...fixture,
            ...sync,
            ...origin,
            ...(isPublic ? publicValues : {}),
          };
          const config = resolve(files, values);
          if (files.includes("compose.dev.yml"))
            assert.deepEqual(config.services.api.command, [
              "sh",
              "/workspace/scripts/api-entrypoint.sh",
              "pnpm",
              "exec",
              "turbo",
              "run",
              "dev",
              "--filter=@nexora/api",
              "--filter=@nexora/shared",
              "--filter=@nexora/database",
            ]);

          for (const key of [...CARRIER_UNISHIP_ENV, ...SYNC_ENV]) {
            const expected =
              sync[key] || SYNC_COMPOSE_DEFAULTS[key] || fixture[key] || "";
            for (const service of ["api", "sync-worker"])
              assert.ok(
                config.services[service].environment[key] === expected,
                `Shared ${service} ${key}`,
              );
          }
          for (const key of IDENTITY_ENV)
            assert.ok(
              config.services.api.environment[key] === fixture[key],
              `API ${key}`,
            );
          assert.equal(
            config.services.api.environment.WEB_PORT,
            origin.WEB_PORT || "127.0.0.1:3001",
          );
          assert.equal(
            config.services.api.environment.ALLOWED_ORIGINS,
            isPublic
              ? publicValues.ALLOWED_ORIGINS
              : origin.ALLOWED_ORIGINS || "",
          );
          assert.equal(
            config.services.web.environment.ALLOWED_HOSTS,
            isPublic ? publicValues.ALLOWED_HOSTS : origin.ALLOWED_HOSTS || "",
          );
          for (const key of IDENTITY_ENV)
            assert.ok(
              !Object.hasOwn(config.services["sync-worker"].environment, key),
              `Worker has no ${key}, even empty`,
            );
          for (const key of [...IDENTITY_ENV, ...CARRIER_UNISHIP_ENV])
            assert.ok(
              !Object.hasOwn(config.services.web.environment, key),
              `Web has no ${key}`,
            );
          for (const name of [
            "migrate",
            "db-runtime",
            "dependencies",
            "builder",
            "init",
          ]) {
            for (const key of [
              ...IDENTITY_ENV,
              "CARRIER_KEYRING_JSON",
              "CARRIER_ACTIVE_KEY_VERSION",
            ])
              assert.ok(
                !Object.hasOwn(config.services[name]?.environment ?? {}, key),
                `Tooling ${name} has no application keyring`,
              );
          }
          for (const service of Object.values(config.services)) {
            const args = service.build?.args ?? {};
            for (const key of [
              ...IDENTITY_ENV,
              "CARRIER_KEYRING_JSON",
              "CARRIER_ACTIVE_KEY_VERSION",
            ])
              assert.ok(
                !Object.hasOwn(args, key),
                "No keyring build arguments",
              );
            for (const value of Object.values(args))
              assert.ok(
                ![
                  fixture.IDENTITY_KEYRING_JSON,
                  fixture.CARRIER_KEYRING_JSON,
                ].some((secret) => String(value).includes(secret)),
                "No key material under renamed build argument",
              );
          }
          if (isPublic) {
            for (const service of ["api", "web"])
              assert.equal(
                config.services[service].environment.ALLOWED_HOSTS,
                publicValues.ALLOWED_HOSTS,
              );
            assert.equal(
              config.services.web.environment.ALLOWED_ORIGINS,
              publicValues.ALLOWED_ORIGINS,
            );
          }
        }
      }
    }
    for (const key of ["PUBLIC_ORIGIN", "ALLOWED_HOSTS", "ALLOWED_ORIGINS"]) {
      const values = { ...fixture, ...publicValues };
      delete values[key];
      resolve(["compose.yml", "compose.public.yml"], values, key);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
