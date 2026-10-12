import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import { createSmokeChecks } from "./smoke-checks.mjs";
const checks = createSmokeChecks(console.error, "PR7_RESTORE_SMOKE_FAILED");
const source = `nexora-pr7-smoke-${process.pid}`,
  target = `${source}-restored`;
const projects = [source, target],
  created = [];
const base = [
  "compose",
  "-f",
  resolve("compose.yml"),
  ...(process.env.NEXORA_COMPOSE_OVERRIDE
    ? ["-f", process.env.NEXORA_COMPOSE_OVERRIDE]
    : []),
];
const pin = "ad01e74ae681ebf57787dc77188cf93b1e1c7f8e";
let work, sourceOverride;
const ports = new Map();
const env = (project) => ({
  ...process.env,
  COMPOSE_PROJECT_NAME: project,
  WEB_PORT: `127.0.0.1:${ports.get(project) || 3001}`,
  ALLOWED_ORIGINS: "",
});
const run = (bin, args, project, input) => {
  try {
    return execFileSync(bin, args, {
      env: project ? env(project) : process.env,
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 600000,
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    throw Object.assign(new Error("Smoke operation failed"), {
      code: "DOCKER_FAILURE",
    });
  }
};
const docker = (project, args, input) =>
  run(
    "docker",
    [
      ...base,
      ...(project === source ? ["-f", sourceOverride] : []),
      "-p",
      project,
      ...args,
    ],
    project,
    input,
  );
const allocate = async (project) => {
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  ports.set(project, server.address().port);
  await new Promise((r) => server.close(r));
};
const url = (project) => `http://127.0.0.1:${ports.get(project) || 3001}`;
const request = (project, path, options = {}) =>
  fetch(url(project) + path, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
const login = async (project) => {
  const r = await request(project, "/api/auth/login", {
    method: "POST",
    headers: { origin: url(project), "content-type": "application/json" },
    body: JSON.stringify({
      username: "pr7_admin",
      password: "Pr7RestoreFixture123!",
    }),
  });
  checks.status(r.status, 200);
  const cookie = /nexora_session=([^;]+)/.exec(
    r.headers.get("set-cookie") || "",
  );
  assert.ok(cookie);
  return { cookie: `nexora_session=${cookie[1]}`, user: (await r.json()).user };
};
const state = (project) =>
  JSON.parse(
    docker(
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
      `const {createDatabase}=require('@nexora/database');(async()=>{const db=createDatabase(process.env.DATABASE_URL);try{console.log(JSON.stringify({users:await db.${project === source ? "localUser" : "user"}.findMany(${project === source ? "" : "{include:{credential:true}}"}),sessions:await db.session.findMany(),files:await db.storedFile.findMany()}));}finally{await db.$disconnect();}})().catch(()=>process.exit(1));`,
    ),
  );
try {
  checks.step("GUARDS");
  for (const project of projects) {
    assert.equal(
      run("docker", [
        "ps",
        "-aq",
        "--filter",
        `label=com.docker.compose.project=${project}`,
      ]).trim(),
      "",
    );
    for (const volume of ["postgres", "uploads", "credentials"]) {
      let exists = false;
      try {
        execFileSync("docker", ["volume", "inspect", `${project}_${volume}`], {
          stdio: "pipe",
        });
        exists = true;
      } catch {
        /* absent */
      }
      assert.equal(exists, false);
    }
  }
  work = await mkdtemp(join(tmpdir(), "nexora-pr7-recovery-"));
  const checkout = join(work, "baseline");
  run("mkdir", ["-p", checkout]);
  try {
    execFileSync("git", ["cat-file", "-e", pin], { stdio: "pipe" });
  } catch {
    run("git", ["fetch", "--no-tags", "origin", pin]);
  }
  const archive = execFileSync("git", ["archive", pin], {
    maxBuffer: 20 * 1024 * 1024,
  });
  execFileSync("tar", ["-x", "-C", checkout], {
    input: archive,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const historical = resolve("scripts/fixtures/local-authentication");
  const provenance = JSON.parse(
    await readFile(join(historical, "provenance.json"), "utf8"),
  );
  for (const [file, digest] of Object.entries(provenance.files))
    assert.equal(
      createHash("sha256")
        .update(await readFile(join(historical, file)))
        .digest("hex"),
      digest,
    );
  const oldImages = join(work, "old-images.yml");
  await writeFile(
    oldImages,
    `services:\n  builder:\n    image: nexora-pr7-builder:ad01e74\n  api:\n    image: nexora-pr7-api:ad01e74\n  web:\n    image: nexora-pr7-web:ad01e74\n`,
  );
  checks.step("BUILD_ACTUAL_PR7_RUNTIME");
  run(
    "docker",
    [
      "compose",
      "-f",
      join(checkout, "compose.yml"),
      "-f",
      oldImages,
      "-p",
      source,
      "build",
      "api",
      "web",
    ],
    source,
  );
  sourceOverride = join(work, "pr7-runtime.yml");
  await writeFile(
    sourceOverride,
    `services:\n  api:\n    image: nexora-pr7-api:ad01e74\n  web:\n    image: nexora-pr7-web:ad01e74\n  migrate:\n    volumes:\n      - type: bind\n        source: ${JSON.stringify(join(historical, "prisma"))}\n        target: /app/prisma\n        read_only: true\n`,
  );
  await allocate(source);
  await allocate(target);
  checks.step("PR7_PROVISION_AND_SESSION");
  created.push(source);
  docker(source, ["up", "-d", "--no-build", "--wait", "--wait-timeout", "180"]);
  const baselineCatalog = docker(source, [
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "nexora",
    "-d",
    "nexora",
    "-Atc",
    "SELECT to_regclass('local_users') IS NOT NULL AND to_regclass('users') IS NULL; SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;",
  ]);
  assert.equal(baselineCatalog.trim(), "t\n2");
  docker(
    source,
    [
      "exec",
      "-T",
      "api",
      "sh",
      "/scripts/api-entrypoint.sh",
      "node",
      "dist/cli/user-create.js",
      "--username",
      "pr7_admin",
      "--password-stdin",
    ],
    "Pr7RestoreFixture123!",
  );
  const old = await login(source);
  const blob = JSON.parse(
    docker(
      source,
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
      `const {DatabaseAdapter}=require('./dist/health/infrastructure/database.adapter');const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');const {FilesService}=require('./dist/storage/application/file-storage.port');(async()=>{const db=new DatabaseAdapter(process.env.DATABASE_URL);try{console.log(JSON.stringify(await new FilesService(new LocalStorage('/data/uploads'),db).save(Buffer.from('PR7 original source bytes'))));}finally{await db.onApplicationShutdown();}})().catch(()=>process.exit(1));`,
    ),
  );
  const before = state(source);
  checks.step("CANONICAL_PR7_BACKUP");
  const backup = join(work, "backup");
  run("sh", ["scripts/backup.sh", backup], source);
  // Canonical backup uses current compose solely to stop the existing project writers and dump unchanged source tables.
  docker(source, ["up", "-d", "--no-build", "--wait", "--wait-timeout", "180"]);
  checks.step("NEW_RELEASE_RESTORE");
  created.push(target);
  run("sh", ["scripts/restore.sh", backup, "--to-new-project", target], target);
  const after = state(target),
    user = after.users.find((u) => u.id === old.user.id),
    previous = before.users.find((u) => u.id === old.user.id);
  assert.ok(user);
  assert.equal(user.username, previous.username);
  assert.equal(user.role, "ADMIN");
  assert.equal(user.status, "ACTIVE");
  assert.equal(user.credential.passwordHash, previous.passwordHash);
  assert.equal(user.createdAt, previous.createdAt);
  assert.equal(user.updatedAt, previous.updatedAt);
  assert.equal(after.sessions.length, 0);
  assert.deepEqual(after.files, before.files);
  docker(
    target,
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
    `const {LocalStorage}=require('./dist/storage/infrastructure/local-storage');(async()=>{const b=await new LocalStorage('/data/uploads').read(${JSON.stringify(blob.id)});if(b.toString()!=='PR7 original source bytes')throw Error('Integrity');})().catch(()=>process.exit(1));`,
  );
  docker(target, ["up", "-d", "--no-build", "--wait", "--wait-timeout", "180"]);
  const stale = await request(target, "/api/auth/session", {
    headers: { cookie: old.cookie },
  });
  checks.status(stale.status, 401);
  assert.equal((await stale.json()).code, "UNAUTHORIZED");
  const fresh = await login(target);
  assert.equal(fresh.user.id, old.user.id);
  checks.status(
    (
      await request(target, "/api/auth/session", {
        headers: { cookie: fresh.cookie },
      })
    ).status,
    200,
  );
  const catalog = docker(target, [
    "exec",
    "-T",
    "postgres",
    "psql",
    "-U",
    "nexora",
    "-d",
    "nexora",
    "-Atc",
    "SELECT to_regclass('users') IS NOT NULL AND to_regclass('user_credentials') IS NOT NULL AND to_regclass('local_users') IS NULL; SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;",
  ]);
  assert.equal(catalog.trim(), "t\n3");
  checks.step("SOURCE_UNCHANGED");
  assert.deepEqual(state(source), before);
  checks.status(
    (
      await request(source, "/api/auth/session", {
        headers: { cookie: old.cookie },
      })
    ).status,
    200,
  );
  console.log(
    "Actual PR7 runtime/CLI canonical backup upgraded, credential/session/file preservation and source isolation PASS",
  );
} catch (error) {
  checks.failure(error);
  process.exitCode = 1;
} finally {
  for (const project of created.reverse())
    docker(project, ["down", "-v", "--remove-orphans"]);
  if (work) await rm(work, { recursive: true, force: true });
}
