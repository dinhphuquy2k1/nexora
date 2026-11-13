// Reuses the signed disposable-cluster launcher; no shared worker credential changes.
import assert from "node:assert/strict";
import { Client } from "pg";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const url = process.env.DISPOSABLE_CLUSTER_ADMIN_URL,
  token = process.env.DISPOSABLE_CLUSTER_TOKEN,
  password = process.env.DISPOSABLE_CLUSTER_RUNTIME_PASSWORD;
assert.ok(url && token && password, "DISPOSABLE_CLUSTER_REQUIRED");
const admin = new Client({ connectionString: url });
await admin.connect();
try {
  const stamp = await admin.query(
    "SELECT description FROM pg_shdescription JOIN pg_database ON objoid=pg_database.oid WHERE datname=current_database()",
  );
  assert.equal(stamp.rows[0]?.description, token);
} finally {
  await admin.end();
}
const dir = await mkdtemp(join(tmpdir(), "nexora-shipment-worker-"));
try {
  const passwordFile = join(dir, "runtime-password");
  await writeFile(passwordFile, password, { mode: 0o600 });
  for (const pkg of ["@nexora/shared", "@nexora/database", "@nexora/api"])
    execFileSync("pnpm", ["--filter", pkg, "build"], {
      stdio: "inherit",
      cwd: resolve("."),
    });
  execFileSync(
    process.execPath,
    ["--test", "integration/shipment-integration.test.cjs"],
    {
      cwd: resolve("apps/api"),
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: url,
        SHIPMENT_TEST_RUNTIME_PASSWORD_FILE: passwordFile,
        STORAGE_ROOT: join(dir, "storage"),
      },
    },
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
