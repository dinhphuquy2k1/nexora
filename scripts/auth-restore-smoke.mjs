import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { createSmokeChecks } from "./smoke-checks.mjs";

const [work, source, restored, legacy, legacyRestored] = process.argv.slice(2);
if (
  !/^nexora-data-smoke-\d+$/.test(source) ||
  restored !== `${source}-restored` ||
  legacy !== `${source}-legacy` ||
  legacyRestored !== `${source}-legacy-restored`
)
  throw new Error("Only this smoke's disposable projects are permitted");
const checks = createSmokeChecks(console.error, "AUTH_RESTORE_SMOKE_FAILED");
const override = process.env.NEXORA_COMPOSE_OVERRIDE;
const base = [
  "compose",
  "-f",
  "compose.yml",
  ...(override ? ["-f", override] : []),
];
const sourceBinding = process.env.WEB_PORT || "127.0.0.1:3001";
const bindings = new Map([[source, sourceBinding]]);
const envFor = (project) => ({
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  WEB_PORT: bindings.get(project) || sourceBinding,
  ALLOWED_ORIGINS: "",
});
const execute = (command, args, project, input) =>
  new Promise((resolvePromise, reject) => {
    const child = execFile(
      command,
      args,
      { env: envFor(project), timeout: 180000, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) =>
        error
          ? reject(
              Object.assign(new Error("Restore smoke operation failed"), {
                code: error.killed ? "DOCKER_TIMEOUT" : "DOCKER_FAILURE",
              }),
            )
          : resolvePromise(stdout),
    );
    child.stdin.end(input);
  });
const docker = (project, args, input) =>
  execute("docker", [...base, "-p", project, ...args], project, input);
const urlFor = (project) =>
  `http://127.0.0.1:${bindings.get(project).split(":").at(-1)}`;
const request = (project, path, options = {}) =>
  fetch(urlFor(project) + path, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
const login = async (project, username, password) => {
  const response = await request(project, "/api/auth/login", {
    method: "POST",
    headers: { origin: urlFor(project), "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  checks.status(response.status, 200);
  const match = /nexora_session=([^;]+)/.exec(
    response.headers.get("set-cookie") || "",
  );
  assert.ok(match, "Session cookie missing");
  return {
    cookie: `nexora_session=${match[1]}`,
    user: (await response.json()).user,
  };
};
const session = async (project, cookie, expected) => {
  const response = await request(project, "/api/auth/session", {
    headers: { cookie },
  });
  checks.status(response.status, expected);
  const body = await response.json();
  if (expected === 401) assert.equal(body.code, "UNAUTHORIZED");
  else assert.equal(body.authenticated, true);
};
const logout = async (project, cookie) => {
  checks.status(
    (
      await request(project, "/api/auth/logout", {
        method: "POST",
        headers: { origin: urlFor(project), cookie },
      })
    ).status,
    200,
  );
};
const allocateBinding = async (project) => {
  const server = createServer();
  await new Promise((resolvePromise) =>
    server.listen(0, "127.0.0.1", resolvePromise),
  );
  const port = server.address().port;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  bindings.set(project, `127.0.0.1:${port}`);
};
const up = (project) =>
  docker(project, [
    "up",
    "-d",
    "--no-build",
    "--wait",
    "--wait-timeout",
    "180",
  ]);
const provision = (project, username, password) =>
  docker(
    project,
    [
      "exec",
      "-T",
      "api",
      "sh",
      "/scripts/api-entrypoint.sh",
      "node",
      "dist/cli/user-create.js",
      "--username",
      username,
      "--password-stdin",
    ],
    password,
  );
const backup = (project) =>
  execute(
    "sh",
    [
      "scripts/backup.sh",
      join(work, project === source ? "backup" : "legacy-backup"),
    ],
    project,
  );
const restore = (from, project) =>
  execute(
    "sh",
    [
      "scripts/restore.sh",
      join(work, from === source ? "backup" : "legacy-backup"),
      "--to-new-project",
      project,
    ],
    project,
  );
const identitySnapshot = async (project) =>
  JSON.parse(
    await docker(
      project,
      [
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "api",
        "sh",
        "/scripts/api-entrypoint.sh",
        "node",
      ],
      `const {createDatabase}=require('@nexora/database');(async()=>{const db=createDatabase(process.env.DATABASE_URL);try{console.log(JSON.stringify(await db.user.findMany({include:{credential:true,externalIdentities:true},orderBy:{id:'asc'}})));}finally{await db.$disconnect();}})().catch(()=>process.exit(1));`,
    ),
  );
const counts = async (project) =>
  JSON.parse(
    await docker(
      project,
      [
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "api",
        "sh",
        "/scripts/api-entrypoint.sh",
        "node",
      ],
      `const {createDatabase}=require('@nexora/database');(async()=>{const db=createDatabase(process.env.DATABASE_URL);try{console.log(JSON.stringify({users:await db.user.count(),sessions:await db.session.count(),files:await db.storedFile.count()}));}finally{await db.$disconnect();}})().catch(()=>process.exit(1));`,
    ),
  );

try {
  checks.step("CURRENT_PROVISION_OPERATOR");
  await provision(source, "restore_operator", "RestoreFixturePass123!");
  checks.step("CURRENT_LOGIN_BEFORE_BACKUP");
  const old = await login(source, "restore_operator", "RestoreFixturePass123!");
  await session(source, old.cookie, 200);
  const alsoBackedUp = await login(
    source,
    "restore_operator",
    "RestoreFixturePass123!",
  );
  await session(source, alsoBackedUp.cookie, 200);
  checks.step("CURRENT_BACKUP_WITH_SESSION");
  await backup(source);
  await up(source);
  checks.step("CURRENT_REVOKE_AFTER_BACKUP");
  await logout(source, old.cookie);
  await session(source, old.cookie, 401);
  // Keep a different live source session to prove target cleanup never invalidates the source.
  const liveSource = await login(
    source,
    "restore_operator",
    "RestoreFixturePass123!",
  );
  const beforeSource = await counts(source);
  const beforeIdentities = await identitySnapshot(source);
  checks.step("CURRENT_RESTORE_ISOLATED");
  await allocateBinding(restored);
  await restore(source, restored);
  const restoredCounts = await counts(restored);
  assert.equal(restoredCounts.sessions, 0);
  assert.equal(restoredCounts.users, beforeSource.users);
  assert.equal(restoredCounts.files, beforeSource.files);
  assert.deepEqual(await identitySnapshot(restored), beforeIdentities);
  await up(restored);
  checks.step("CURRENT_RESTORED_OLD_SESSION_REJECTED");
  await session(restored, old.cookie, 401);
  await session(restored, alsoBackedUp.cookie, 401);
  checks.step("CURRENT_RESTORED_OPERATOR_LOGIN");
  const renewed = await login(
    restored,
    "restore_operator",
    "RestoreFixturePass123!",
  );
  assert.equal(renewed.user.id, old.user.id);
  assert.equal(renewed.user.username, old.user.username);
  await session(restored, renewed.cookie, 200);
  await logout(restored, renewed.cookie);
  checks.step("SOURCE_SESSION_AND_DATA_UNCHANGED");
  await session(source, liveSource.cookie, 200);
  await session(source, alsoBackedUp.cookie, 200);
  await session(source, old.cookie, 401);
  assert.deepEqual(await counts(source), beforeSource);
  assert.deepEqual(await identitySnapshot(source), beforeIdentities);

  checks.step("LEGACY_FIXTURE_PROVENANCE");
  const fixture = resolve("scripts/fixtures/pre-authentication");
  const provenance = JSON.parse(
    await readFile(join(fixture, "provenance.json"), "utf8"),
  );
  for (const [file, digest] of Object.entries(provenance.files))
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(fixture, file)))
        .digest("hex"),
      digest,
    );
  const legacyOverride = join(work, "legacy-prisma.yml");
  await writeFile(
    legacyOverride,
    `services:\n  migrate:\n    volumes:\n      - type: bind\n        source: ${JSON.stringify(join(fixture, "prisma"))}\n        target: /app/prisma\n        read_only: true\n`,
  );
  checks.step("LEGACY_CREATE_HISTORICAL_SCHEMA");
  await docker(legacy, [
    "up",
    "-d",
    "--no-build",
    "--wait",
    "--wait-timeout",
    "120",
    "postgres",
  ]);
  // Existing Prisma runner builds genuine metadata from only the authentic historical migration.
  await execute(
    "docker",
    [
      ...base,
      "-f",
      legacyOverride,
      "-p",
      legacy,
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "migrate",
    ],
    legacy,
  );
  const historical = await docker(legacy, [
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "nexora",
    "-d",
    "nexora",
    "-Atc",
    "SELECT to_regclass('public.local_users') IS NULL AND to_regclass('public.sessions') IS NULL; SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;",
  ]);
  assert.equal(historical.trim(), "t\n1");
  checks.step("LEGACY_STORE_ORIGINAL_FILE");
  const legacyBlob = JSON.parse(
    await docker(
      legacy,
      [
        "run",
        "--rm",
        "--no-deps",
        "-T",
        "api",
        "sh",
        "/scripts/api-entrypoint.sh",
        "node",
      ],
      `const {DatabaseAdapter}=require('./dist/health/infrastructure/database.adapter');const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');const {FilesService}=require('./dist/storage/application/file-storage.port');(async()=>{const db=new DatabaseAdapter(process.env.DATABASE_URL);try{console.log(JSON.stringify(await new FilesService(new LocalStorage('/data/uploads'),db).save(Buffer.from('Nexora legacy original source smoke'))));}finally{await db.onApplicationShutdown();}})().catch(()=>process.exit(1));`,
    ),
  );
  checks.step("LEGACY_BACKUP_AND_RESTORE");
  await backup(legacy);
  await allocateBinding(legacyRestored);
  await restore(legacy, legacyRestored);
  assert.deepEqual(await counts(legacyRestored), {
    users: 0,
    sessions: 0,
    files: 1,
  });
  const migrations = await docker(legacyRestored, [
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "nexora",
    "-d",
    "nexora",
    "-Atc",
    "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;",
  ]);
  assert.equal(migrations.trim(), "4");
  checks.step("LEGACY_ORIGINAL_FILE_INTEGRITY");
  await docker(
    legacyRestored,
    [
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "api",
      "sh",
      "/scripts/api-entrypoint.sh",
      "node",
    ],
    `const {createDatabase}=require('@nexora/database');const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');const {createHash}=require('node:crypto');(async()=>{const db=createDatabase(process.env.DATABASE_URL);try{const row=await db.storedFile.findUniqueOrThrow({where:{id:${JSON.stringify(legacyBlob.id)}}});const bytes=await new LocalStorage('/data/uploads').read(row.id);if(bytes.toString()!=='Nexora legacy original source smoke'||bytes.length!==row.sizeBytes||createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('Integrity');}finally{await db.$disconnect();}})().catch(()=>process.exit(1));`,
  );
  checks.step("LEGACY_FIRST_OPERATOR_AND_LOGIN");
  await up(legacyRestored);
  await provision(legacyRestored, "legacy_operator", "LegacyFixturePass123!");
  const first = await login(
    legacyRestored,
    "legacy_operator",
    "LegacyFixturePass123!",
  );
  await session(legacyRestored, first.cookie, 200);
  await logout(legacyRestored, first.cookie);
  await session(legacyRestored, first.cookie, 401);
  checks.step("SOURCE_STILL_UNCHANGED_AFTER_LEGACY_RECOVERY");
  await session(source, liveSource.cookie, 200);
  assert.deepEqual(await counts(source), beforeSource);
  assert.deepEqual(await identitySnapshot(source), beforeIdentities);
  await logout(source, liveSource.cookie);
  await logout(source, alsoBackedUp.cookie);
  console.log(
    "Current/legacy restore, exact old-session 401, account recovery and source isolation PASS",
  );
} catch (error) {
  checks.failure(error);
  process.exitCode = 1;
}
