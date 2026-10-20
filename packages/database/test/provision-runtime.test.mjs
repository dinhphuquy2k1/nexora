import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import {
  provisionRuntime,
  isRetryableProvisionError,
} from "../scripts/provision-runtime.mjs";
import { assertRuntimePrivileges } from "./runtime-privilege-assertions.mjs";

test("isRetryableProvisionError correctly classifies retryable and permanent errors", () => {
  // 55P03 = lock_not_available (e.g. lock_timeout elapsed waiting for concurrent provisioner)
  assert.equal(isRetryableProvisionError({ code: "55P03" }), true);

  // XX000 with routine simple_heap_update = catalog tuple update conflict
  assert.equal(
    isRetryableProvisionError({
      code: "XX000",
      routine: "simple_heap_update",
      message: "tuple concurrently updated",
    }),
    true,
  );

  // XX000 with message match fallback
  assert.equal(
    isRetryableProvisionError({
      code: "XX000",
      message: "error: tuple concurrently updated",
    }),
    true,
  );

  // Generic XX000 without simple_heap_update or concurrently updated is not retryable
  assert.equal(
    isRetryableProvisionError({
      code: "XX000",
      routine: "some_other_routine",
      message: "disk full or catalog corruption",
    }),
    false,
  );

  // Permanent errors must never be retried
  assert.equal(
    isRetryableProvisionError({ code: "42501", message: "permission denied" }),
    false,
  );
  assert.equal(
    isRetryableProvisionError({
      code: "28P01",
      message: "password authentication failed",
    }),
    false,
  );
  assert.equal(
    isRetryableProvisionError({
      code: "3D000",
      message: "database does not exist",
    }),
    false,
  );
  assert.equal(
    isRetryableProvisionError({
      code: "42P01",
      message: "relation does not exist",
    }),
    false,
  );
  assert.equal(isRetryableProvisionError(new Error("generic error")), false);
  assert.equal(isRetryableProvisionError(null), false);
  assert.equal(isRetryableProvisionError(undefined), false);
});

test("provisionRuntime rejects invalid password secret format and invalid timeout", async () => {
  await assert.rejects(
    provisionRuntime("postgresql://invalid", "short_secret"),
    (err) => err.message === "INVALID_RUNTIME_SECRET",
  );
  await assert.rejects(
    provisionRuntime("postgresql://invalid", "g".repeat(64)),
    (err) => err.message === "INVALID_RUNTIME_SECRET",
  );
  await assert.rejects(
    provisionRuntime("postgresql://invalid", "a".repeat(64), {
      lockTimeout: "invalid;injection",
    }),
    (err) => err.message === "INVALID_TIMEOUT_FORMAT",
  );
});

test("provisionRuntime does not leak secret password in error output", async () => {
  const secret = "f".repeat(64);
  try {
    // Non-existent host/port fails closed immediately
    await provisionRuntime(
      "postgresql://nexora:nonexistent@127.0.0.1:59999/nexora",
      secret,
      { maxAttempts: 1 },
    );
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal(err.message, "DATABASE_RUNTIME_PROVISION_FAILED");
    const errorStr =
      JSON.stringify(err) + " " + err.message + " " + String(err);
    assert.ok(
      !errorStr.includes(secret),
      "Error output must never leak the runtime secret password",
    );
  }
});

test("concurrent database runtime provisioning and bounded timeout recovery", async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip("isolated admin DATABASE_URL required for real PostgreSQL tests");
    return;
  }

  const admin = new Client({ connectionString: process.env.DATABASE_URL });
  await admin.connect();

  const nameA = "nexora_prov_test_a_" + randomUUID().replaceAll("-", "");
  const nameB = "nexora_prov_test_b_" + randomUUID().replaceAll("-", "");
  const nameTimeout =
    "nexora_prov_test_timeout_" + randomUUID().replaceAll("-", "");
  const ownedDbs = [nameA, nameB, nameTimeout];

  const root = new URL("../prisma/migrations/", import.meta.url);
  const migrationEntries = (await readdir(root))
    .sort()
    .filter((e) => /^\d/.test(e));

  async function setupDb(dbName) {
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + dbName;
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS _prisma_migrations (
          id VARCHAR(36) PRIMARY KEY,
          checksum VARCHAR(64) NOT NULL,
          finished_at TIMESTAMPTZ,
          migration_name VARCHAR(255) NOT NULL,
          logs TEXT,
          rolled_back_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          applied_steps_count INTEGER NOT NULL DEFAULT 0
        )
      `);
      for (const entry of migrationEntries) {
        const sql = await readFile(
          new URL(entry + "/migration.sql", root),
          "utf8",
        );
        await db.query(sql);
      }
    } finally {
      await db.end();
    }
    return url.toString();
  }

  try {
    // Setup databases sequentially on admin connection to avoid concurrent queries on single client
    const urlA = await setupDb(nameA);
    const urlB = await setupDb(nameB);
    const urlTimeout = await setupDb(nameTimeout);

    const secretA = randomBytes(32).toString("hex");
    const secretB = randomBytes(32).toString("hex");

    // 1. Concurrent provisioning test: Run two provisioners concurrently on separate databases
    // Must succeed without tuple concurrently updated error
    await Promise.all([
      provisionRuntime(urlA, secretA),
      provisionRuntime(urlB, secretB),
    ]);

    // 2. Validate runtime privileges on both databases
    // (Note: secretB was set last, so nexora_app has password secretB across the cluster)
    await assertRuntimePrivileges(urlA, secretB);
    await assertRuntimePrivileges(urlB, secretB);

    // 3. Bounded lock waiting and failure recovery test
    // Hold an exclusive lock on pg_authid in a separate connection
    const lockHolder = new Client({
      connectionString: process.env.DATABASE_URL,
    });
    await lockHolder.connect();
    await lockHolder.query("BEGIN");
    await lockHolder.query("LOCK TABLE pg_authid IN EXCLUSIVE MODE");

    const secretTimeout = randomBytes(32).toString("hex");

    // Attempt provisionRuntime with a tight 500ms lock timeout
    // Must fail bounded with 55P03 lock timeout, not hang indefinitely
    await assert.rejects(
      provisionRuntime(urlTimeout, secretTimeout, {
        lockTimeout: "500ms",
        maxAttempts: 1,
      }),
      (err) => {
        assert.equal(err.message, "DATABASE_RUNTIME_PROVISION_FAILED");
        assert.equal(err.cause?.code, "55P03");
        return true;
      },
    );

    // Release the blocker
    await lockHolder.query("ROLLBACK");
    await lockHolder.end();

    // Now provisionRuntime must succeed after blocker is released
    await provisionRuntime(urlTimeout, secretTimeout);
    await assertRuntimePrivileges(urlTimeout, secretTimeout);
  } finally {
    for (const dbName of ownedDbs) {
      await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`).catch(() => {});
    }
    await admin.end();
  }
});
