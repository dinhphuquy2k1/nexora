import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dockerCommand } from "./docker-command.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), ".."),
  run = randomUUID().replaceAll("-", ""),
  name = `nexora-cleanup-${run}`,
  db = `nexora_test_${run}`;
let id,
  step = "START",
  interrupted;
const onInt = () => {
    interrupted ??= 2;
  },
  onTerm = () => {
    interrupted ??= 15;
  };
process.on("SIGINT", onInt);
process.on("SIGTERM", onTerm);
const command = (args, options) => dockerCommand(args, options);
function require(value) {
  if (!value) throw Error(step);
  if (interrupted) throw Error("INTERRUPTED");
}
async function sql(statement, database = db) {
  const r = await command(
    [
      "exec",
      "-i",
      id,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      database,
      "-At",
      "-q",
    ],
    { data: statement },
  );
  require(r.code === 0);
  return r.stdout.trim();
}
async function cleanupSql(overrides = {}) {
  const values = {
    deployment_env: "development",
    expected_database: db,
    username_prefix: "test_demo",
    ...overrides,
  };
  const args = [
    "exec",
    id,
    "psql",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    "postgres",
    "-d",
    db,
    "-f",
    "/tmp/cleanup.sql",
  ];
  for (const [key, value] of Object.entries(values))
    args.push("-v", `${key}=${value}`);
  return command(args);
}
async function ownedState(identity) {
  const r = await command(["inspect", identity], { timeout: 5000 });
  if (r.code !== 0) throw Error("OWNERSHIP_UNVERIFIED");
  let s;
  try {
    const arr = JSON.parse(r.stdout);
    if (!Array.isArray(arr) || arr.length !== 1 || !arr[0]) throw Error();
    s = arr[0];
  } catch {
    throw Error("OWNERSHIP_UNVERIFIED");
  }
  if (
    s.Id !== identity ||
    s.Config?.Labels?.["nexora.cleanup-test"] !== run ||
    s.Name !== `/${name}` ||
    !/^[a-f0-9]{64}$/.test(s.Id)
  )
    throw Error("OWNERSHIP_UNVERIFIED");
  return s;
}
async function cleanupOwned() {
  // Recover a partial create only after verifying the unique name and per-run label.
  if (!id) {
    const r = await command(["inspect", name], { timeout: 5000 });
    if (r.code === 0) {
      let s;
      try {
        const arr = JSON.parse(r.stdout);
        if (!Array.isArray(arr) || arr.length !== 1 || !arr[0]) throw Error();
        s = arr[0];
      } catch {
        throw Error("UNVERIFIABLE_CREATION");
      }
      await ownedState(s.Id);
      id = s.Id;
    } else if (
      r.code !== 1 ||
      ![
        `Error: No such object: ${name}`,
        `Error response from daemon: No such object: ${name}`,
      ].includes(r.stderr.trim())
    )
      throw Error("UNVERIFIABLE_CREATION");
  }
  if (id) {
    await ownedState(id);
    await command(["rm", "-fv", id], { timeout: 10000 });
    const r = await command(["inspect", id], { timeout: 5000 });
    if (
      r.code !== 1 ||
      ![
        `Error: No such object: ${id}`,
        `Error response from daemon: No such object: ${id}`,
      ].includes(r.stderr.trim())
    )
      throw Error("CLEANUP_UNVERIFIED");
  }
}
let failed = false;
try {
  const r = await command([
    "create",
    "--network",
    "none",
    "--name",
    name,
    "--label",
    `nexora.cleanup-test=${run}`,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17.11-bookworm",
  ]);
  id = r.stdout.trim();
  if (!/^[a-f0-9]{64}$/.test(id)) {
    id = undefined;
    throw Error("CREATE_FAILED");
  }
  await ownedState(id);
  require(r.code === 0);
  require((await command(["start", id])).code === 0);
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    require(true);
    if (
      (
        await command([
          "exec",
          id,
          "pg_isready",
          "-h",
          "127.0.0.1",
          "-U",
          "postgres",
        ])
      ).code === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  require(ready);
  await sql(`CREATE DATABASE "${db}"`, "postgres");
  step = "DDL_AND_FIXTURES";
  const migrations = resolve(root, "packages/database/prisma/migrations");
  for (const m of (await readdir(migrations)).sort())
    if (/^\d/.test(m))
      await sql(
        await readFile(resolve(migrations, m, "migration.sql"), "utf8"),
      );
  await sql(`INSERT INTO users(id,username,role,updated_at) VALUES
 ('00000000-0000-4000-8000-000000000001','test_demo-admin','ADMIN',now()),
 ('00000000-0000-4000-8000-000000000002','test_demo-unconfigured','OPERATOR',now()),
 ('00000000-0000-4000-8000-000000000003','test_demo-configured','OPERATOR',now()),
 ('00000000-0000-4000-8000-000000000004','other-unconfigured','OPERATOR',now());
 INSERT INTO user_credentials(user_id,password_hash) VALUES ('00000000-0000-4000-8000-000000000003','fixture-not-used-for-login');`);
  require(
    (
      await command([
        "cp",
        resolve(root, "scripts/sql/cleanup-dev-operators.sql"),
        `${id}:/tmp/cleanup.sql`,
      ])
    ).code === 0,
  );
  step = "DRY_RUN_AND_GUARDS";
  require((await cleanupSql()).code === 0);
  require((await sql("SELECT count(*) FROM users")) === "4");
  for (const invalid of [
    { deployment_env: "production" },
    { expected_database: "wrong" },
    { username_prefix: "" },
    { dry_run: "false" },
    { dry_run: "false", confirmation: "wrong" },
  ]) {
    require((await cleanupSql(invalid)).code !== 0);
    require((await sql("SELECT count(*) FROM users")) === "4");
  }
  step = "EXPLICIT_DELETE";
  require(
    (
      await cleanupSql({
        dry_run: "false",
        confirmation: "DELETE_TEST_OPERATORS",
      })
    ).code === 0,
  );
  require((await sql("SELECT count(*) FROM users")) === "3");
  require(
    (await sql(
      "SELECT count(*) FROM users WHERE username='test_demo-unconfigured'",
    )) === "0",
  );
  require((await sql("SELECT count(*) FROM users WHERE role='ADMIN'")) === "1");
  require((await sql("SELECT count(*) FROM user_credentials")) === "1");
} catch {
  failed = true;
  console.error(`DEV_CLEANUP_TEST_FAILED step=${step}`);
} finally {
  try {
    await cleanupOwned();
  } catch {
    failed = true;
    console.error("DEV_CLEANUP_TEST_FAILED step=CLEANUP_UNVERIFIED");
  }
  process.off("SIGINT", onInt);
  process.off("SIGTERM", onTerm);
}
process.exitCode = interrupted ? 128 + interrupted : failed ? 1 : 0;
if (process.exitCode === 0)
  console.log(
    "Actual psql cleanup dry-run, guards and protected-user preservation PASS",
  );
