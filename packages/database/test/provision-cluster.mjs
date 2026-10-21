import assert from "node:assert/strict";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { provisionRuntime } from "../scripts/provision-runtime.mjs";
import { assertRuntimePrivileges } from "./runtime-privilege-assertions.mjs";

const adminUrl = process.env.DISPOSABLE_CLUSTER_ADMIN_URL;
const clusterToken = process.env.DISPOSABLE_CLUSTER_TOKEN;

if (!adminUrl || !clusterToken) {
  console.error(
    "DISPOSABLE_CLUSTER_REQUIRED: This integration suite mutates cluster-global roles and must be executed by an authorized disposable cluster launcher.",
  );
  process.exit(1);
}

const admin = new Client({ connectionString: adminUrl });
await admin.connect();

// 1. Verify disposable cluster ownership token
const tokenQuery = await admin.query(
  "SELECT description FROM pg_shdescription WHERE objoid = (SELECT oid FROM pg_database WHERE datname = current_database())",
);
const clusterComment = tokenQuery.rows[0]?.description;
if (clusterComment !== clusterToken) {
  console.error(
    "CLUSTER_OWNERSHIP_UNVERIFIED: PostgreSQL cluster does not match the expected disposable cluster token signature.",
  );
  await admin.end();
  process.exit(1);
}

// 2. Fail closed if cluster contains existing production/staging database
const existingDbs = (
  await admin.query(
    "SELECT datname FROM pg_database WHERE datname IN ('production', 'staging')",
  )
).rows;
if (existingDbs.length > 0) {
  console.error(
    "UNSAFE_CLUSTER_STATE: Cluster contains persistent production/staging databases.",
  );
  await admin.end();
  process.exit(1);
}

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
  const url = new URL(adminUrl);
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
  const urlA = await setupDb(nameA);
  const urlB = await setupDb(nameB);
  const urlTimeout = await setupDb(nameTimeout);

  // A. Concurrency test:
  // Both concurrent provisioners use the same runtime secret, matching standard
  // Nexora deployment where all containers/services share /runtime-config/postgres_app_password.
  // Serialization must succeed without tuple concurrently updated error and without
  // assuming Promise.all completion order.
  const sharedRuntimeSecret =
    process.env.DISPOSABLE_CLUSTER_RUNTIME_PASSWORD ||
    randomBytes(32).toString("hex");

  await Promise.all([
    provisionRuntime(urlA, sharedRuntimeSecret),
    provisionRuntime(urlB, sharedRuntimeSecret),
  ]);

  await assertRuntimePrivileges(urlA, sharedRuntimeSecret);
  await assertRuntimePrivileges(urlB, sharedRuntimeSecret);

  // B. Bounded lock waiting, timeout recovery, and safe lockHolder cleanup:
  const lockHolder = new Client({ connectionString: adminUrl });
  try {
    await lockHolder.connect();
    await lockHolder.query("BEGIN");
    await lockHolder.query("LOCK TABLE pg_authid IN EXCLUSIVE MODE");

    const secretTimeout = randomBytes(32).toString("hex");

    // Attempt provisionRuntime with tight 500ms timeout; must fail bounded with 55P03
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
  } finally {
    await lockHolder.query("ROLLBACK").catch(() => {});
    await lockHolder.end().catch(() => {});
  }

  // After blocker transaction is rolled back and closed, provisioning succeeds
  const timeoutPass = randomBytes(32).toString("hex");
  await provisionRuntime(urlTimeout, timeoutPass);
  await assertRuntimePrivileges(urlTimeout, timeoutPass);

  // C. Security: Verify error paths on live PostgreSQL never leak credentials
  // 1. Lock timeout error path (55P03):
  const lockHolder2 = new Client({ connectionString: adminUrl });
  const syntheticRuntimeSecret = "e".repeat(64);
  try {
    await lockHolder2.connect();
    await lockHolder2.query("BEGIN");
    await lockHolder2.query("LOCK TABLE pg_authid IN EXCLUSIVE MODE");

    try {
      await provisionRuntime(urlTimeout, syntheticRuntimeSecret, {
        lockTimeout: "500ms",
        maxAttempts: 1,
      });
      assert.fail("should have failed on lock timeout");
    } catch (err) {
      assert.equal(err.message, "DATABASE_RUNTIME_PROVISION_FAILED");
      const errTexts = [
        err.message,
        err.stack || "",
        err.cause?.message || "",
        err.cause?.stack || "",
        String(err),
      ];
      for (const t of errTexts) {
        assert.ok(
          !t.includes(syntheticRuntimeSecret),
          "Must not leak runtime secret",
        );
      }
    }
  } finally {
    await lockHolder2.query("ROLLBACK").catch(() => {});
    await lockHolder2.end().catch(() => {});
  }

  // 2. Permission failure / restricted user error path (42501):
  const restrictedRoleName =
    "nexora_test_restricted_" + randomUUID().replaceAll("-", "");
  const restrictedPassword = randomBytes(32).toString("hex");
  await admin.query(
    `CREATE ROLE "${restrictedRoleName}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '${restrictedPassword}'`,
  );
  await admin.query(
    `GRANT CONNECT ON DATABASE "${nameTimeout}" TO "${restrictedRoleName}"`,
  );

  const restrictedUrl = new URL(adminUrl);
  restrictedUrl.pathname = "/" + nameTimeout;
  restrictedUrl.username = restrictedRoleName;
  restrictedUrl.password = restrictedPassword;

  const leakSecret = "d".repeat(64);
  try {
    await provisionRuntime(restrictedUrl.toString(), leakSecret, {
      maxAttempts: 1,
    });
    assert.fail("restricted role should have failed provisioning");
  } catch (err) {
    assert.equal(err.message, "DATABASE_RUNTIME_PROVISION_FAILED");
    const errTexts = [
      err.message,
      err.stack || "",
      err.cause?.message || "",
      err.cause?.stack || "",
      String(err),
    ];
    for (const t of errTexts) {
      assert.ok(
        !t.includes(leakSecret),
        "Must not leak secret on permission denial",
      );
      assert.ok(
        !t.includes(restrictedPassword),
        "Must not leak role password on denial",
      );
    }
  } finally {
    await admin
      .query(`DROP ROLE IF EXISTS "${restrictedRoleName}"`)
      .catch(() => {});
  }

  console.log("PostgreSQL disposable cluster provisioning regression PASS");
} finally {
  for (const dbName of ownedDbs) {
    await admin
      .query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
      .catch(() => {});
  }
  await admin.end().catch(() => {});
}
