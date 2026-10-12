import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createRequire } from "node:module";
import { randomUUID, createHash } from "node:crypto";
import { createDatabase, hashPassword, verifyPassword } from "../dist/index.js";
const require = createRequire(import.meta.url);
const cli = resolve("node_modules/prisma/build/cli.js");
const configModule = require.resolve("prisma/config");
const migration = "20261012010000_unified_identity";
const fixture = resolve("../../scripts/fixtures/local-authentication");
const original = resolve("prisma/migrations", migration, "migration.sql");
const sourceUrl = process.env.DATABASE_URL;
assert.ok(sourceUrl, "DATABASE_URL required");
const admin = createDatabase(sourceUrl);
const owned = [];
const clients = [];
let work;
let step = "BASELINE";
const command = (url, config, args, failure = false) => {
  let failed = false;
  try {
    execFileSync(process.execPath, [cli, ...args, "--config", config], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
      timeout: 120000,
    });
  } catch {
    failed = true;
  }
  assert.equal(failed, failure, "Prisma command outcome");
};
const snapshot = async (db) => ({
  users: await db.$queryRawUnsafe("SELECT * FROM local_users ORDER BY id"),
  sessions: await db.$queryRawUnsafe("SELECT * FROM sessions ORDER BY id"),
  columns: await db.$queryRawUnsafe(
    "SELECT table_name,column_name,data_type,is_nullable,column_default,character_maximum_length FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('local_users','users','user_credentials','sessions') ORDER BY table_name,column_name",
  ),
  constraints: await db.$queryRawUnsafe(
    "SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid IN ('local_users'::regclass,'sessions'::regclass) ORDER BY conname",
  ),
});
try {
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
  work = await mkdtemp(join(tmpdir(), "nexora-prisma-migration-"));
  await cp(join(fixture, "prisma"), join(work, "prisma"), { recursive: true });
  const config = join(work, "prisma.config.ts");
  await writeFile(
    config,
    `import {defineConfig} from ${JSON.stringify(configModule)};export default defineConfig({schema:${JSON.stringify(join(work, "prisma/schema.prisma"))},migrations:{path:${JSON.stringify(join(work, "prisma/migrations"))}},datasource:{url:process.env.DATABASE_URL}});`,
  );
  const name = "nexora_identity_test_" + randomUUID().replaceAll("-", "");
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  owned.push(name);
  const url = new URL(sourceUrl);
  url.pathname = "/" + name;
  const db = createDatabase(url.toString());
  clients.push(db);
  command(url.toString(), config, ["migrate", "deploy"]);
  const password = "MigrationFixturePass123!";
  const hash = await hashPassword(password);
  const ids = [randomUUID(), randomUUID()];
  for (let i = 0; i < ids.length; i++) {
    await db.$executeRawUnsafe(
      "INSERT INTO local_users(id,username,password_hash,is_active,created_at,updated_at) VALUES($1::uuid,$2,$3,$4,$5::timestamptz,$5::timestamptz)",
      ids[i],
      `migration-${i}`,
      hash,
      i === 0,
      "2026-01-02T03:04:05.678Z",
    );
    await db.$executeRawUnsafe(
      "INSERT INTO sessions(id,token_hash,user_id,expires_at) VALUES($1::uuid,$2,$3::uuid,$4::timestamptz)",
      randomUUID(),
      createHash("sha256").update(ids[i]).digest("hex"),
      ids[i],
      "2099-01-01T00:00:00Z",
    );
  }
  const before = await snapshot(db);
  const sql = await readFile(original, "utf8");
  const target = join(work, "prisma/migrations", migration);
  await cp(resolve("prisma/migrations", migration), target, {
    recursive: true,
  });
  step = "FAILURE_INJECTION";
  assert.equal(sql.split("-- FAILURE_INJECTION_POINT").length, 2);
  await writeFile(
    join(target, "migration.sql"),
    sql.replace(
      "-- FAILURE_INJECTION_POINT",
      "DO $$ BEGIN RAISE EXCEPTION 'injected migration rollback test'; END $$;\n-- FAILURE_INJECTION_POINT",
    ),
  );
  command(url.toString(), config, ["migrate", "deploy"], true);
  assert.deepEqual(await snapshot(db), before);
  const failed = await db.$queryRawUnsafe(
    "SELECT finished_at,rolled_back_at FROM _prisma_migrations WHERE migration_name=$1",
    migration,
  );
  assert.equal(failed.length, 1);
  assert.equal(failed[0].finished_at, null);
  assert.equal(failed[0].rolled_back_at, null);
  step = "SUPPORTED_RECOVERY";
  command(url.toString(), config, [
    "migrate",
    "resolve",
    "--rolled-back",
    migration,
  ]);
  await writeFile(join(target, "migration.sql"), sql);
  command(url.toString(), config, ["migrate", "deploy"]);
  const history = await db.$queryRawUnsafe(
    "SELECT checksum,finished_at,rolled_back_at FROM _prisma_migrations WHERE migration_name=$1 ORDER BY started_at",
    migration,
  );
  assert.equal(history.length, 2);
  assert.ok(history[0].rolled_back_at);
  assert.ok(history[1].finished_at);
  assert.equal(
    history[1].checksum,
    createHash("sha256").update(sql).digest("hex"),
  );
  step = "PRESERVATION_AND_CATALOG";
  const users = await db.user.findMany({
    include: { credential: true },
    orderBy: { id: "asc" },
  });
  assert.equal(users.length, 2);
  for (const old of before.users) {
    const user = users.find((u) => u.id === old.id);
    assert.ok(user);
    assert.equal(user.username, old.username);
    assert.equal(user.role, "ADMIN");
    assert.equal(user.status, old.is_active ? "ACTIVE" : "DISABLED");
    assert.deepEqual(user.createdAt, old.created_at);
    assert.deepEqual(user.updatedAt, old.updated_at);
    assert.equal(user.credential.passwordHash, old.password_hash);
    assert.equal(
      await verifyPassword(password, user.credential.passwordHash),
      true,
    );
  }
  assert.deepEqual(
    await db.$queryRawUnsafe("SELECT * FROM sessions ORDER BY id"),
    before.sessions,
  );
  const cols = await db.$queryRawUnsafe(
    "SELECT column_name,is_nullable,column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='users'",
  );
  assert.equal(cols.find((c) => c.column_name === "role").column_default, null);
  assert.equal(cols.find((c) => c.column_name === "role").is_nullable, "NO");
  assert.match(
    cols.find((c) => c.column_name === "status").column_default,
    /ACTIVE/,
  );
  const constraints = await db.$queryRawUnsafe(
    "SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid IN ('users'::regclass,'user_credentials'::regclass,'sessions'::regclass)",
  );
  for (const expected of [
    "users_pkey",
    "users_role_check",
    "users_status_check",
    "user_credentials_pkey",
    "user_credentials_user_id_fkey",
    "sessions_user_id_fkey",
  ])
    assert.ok(constraints.some((c) => c.conname === expected));
  const indexes = await db.$queryRawUnsafe(
    "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'",
  );
  for (const expected of [
    "users_username_key",
    "sessions_user_id_idx",
    "sessions_expires_at_idx",
    "sessions_token_hash_key",
  ])
    assert.ok(indexes.some((i) => i.indexname === expected));
  assert.ok(
    !indexes.some(
      (i) =>
        i.indexname === "sessions_user_id_idx" && /UNIQUE/.test(i.indexdef),
    ),
  );
  const absent = await db.$queryRawUnsafe(
    "SELECT to_regclass('public.local_users') IS NULL AND to_regclass('public.local_credentials') IS NULL AS absent",
  );
  assert.equal(absent[0].absent, true);
  await assert.rejects(
    db.user.create({ data: { username: "invalid-role", role: "INVALID" } }),
  );
  await assert.rejects(
    db.user.create({
      data: { username: "invalid-status", role: "ADMIN", status: "INVALID" },
    }),
  );
  await assert.rejects(
    db.$executeRawUnsafe(
      "INSERT INTO users(id,username,updated_at) VALUES($1::uuid,'missing-role',now())",
      randomUUID(),
    ),
  );
  const extra = await db.user.create({
    data: { username: "status-default", role: "OPERATOR" },
  });
  assert.equal(extra.status, "ACTIVE");
  await assert.rejects(
    db.userCredential.create({
      data: { userId: randomUUID(), passwordHash: hash },
    }),
  );
  await assert.rejects(
    db.userCredential.create({ data: { userId: ids[0], passwordHash: hash } }),
  );
  await db.userCredential.create({
    data: { userId: extra.id, passwordHash: hash },
  });
  await db.user.delete({ where: { id: extra.id } });
  assert.equal(
    await db.userCredential.findUnique({ where: { userId: extra.id } }),
    null,
  );
  step = "PHASE_2_EXTERNAL_IDENTITIES_MIGRATION";
  const phase2Migration = "20261012020000_external_identities";
  await cp(
    resolve("prisma/migrations", phase2Migration),
    join(work, "prisma/migrations", phase2Migration),
    { recursive: true },
  );
  command(url.toString(), config, ["migrate", "deploy"]);

  const extConstraints = await db.$queryRawUnsafe(
    "SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace AND conrelid='external_identities'::regclass",
  );
  for (const expected of [
    "external_identities_pkey",
    "external_identities_user_id_fkey",
    "external_identities_provider_check",
    "external_identities_provider_subject_check",
  ]) {
    assert.ok(
      extConstraints.some((c) => c.conname === expected),
      `Missing constraint ${expected}`,
    );
  }

  const extIndexes = await db.$queryRawUnsafe(
    "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='external_identities'",
  );
  for (const expected of [
    "external_identities_provider_provider_subject_key",
    "external_identities_user_id_provider_key",
    "external_identities_user_id_idx",
  ]) {
    assert.ok(
      extIndexes.some((i) => i.indexname === expected),
      `Missing index ${expected}`,
    );
  }

  const operatorUser = await db.user.create({
    data: { username: "op-external-test", role: "OPERATOR", status: "ACTIVE" },
  });
  const extIdentity = await db.externalIdentity.create({
    data: {
      userId: operatorUser.id,
      provider: "uniship",
      providerSubject: "uniship-test-001",
    },
  });
  assert.equal(extIdentity.provider, "uniship");
  assert.equal(extIdentity.providerSubject, "uniship-test-001");

  const operatorUser2 = await db.user.create({
    data: {
      username: "op-external-test-2",
      role: "OPERATOR",
      status: "ACTIVE",
    },
  });
  await assert.rejects(
    db.externalIdentity.create({
      data: {
        userId: operatorUser2.id,
        provider: "uniship",
        providerSubject: "uniship-test-001",
      },
    }),
  );

  await assert.rejects(
    db.externalIdentity.create({
      data: {
        userId: operatorUser.id,
        provider: "uniship",
        providerSubject: "uniship-test-002",
      },
    }),
  );

  await assert.rejects(
    db.$executeRawUnsafe(
      "INSERT INTO external_identities(id, user_id, provider, provider_subject, updated_at) VALUES($1::uuid, $2::uuid, 'invalid_provider', 'subj', now())",
      randomUUID(),
      operatorUser2.id,
    ),
  );

  await assert.rejects(
    db.$executeRawUnsafe(
      "INSERT INTO external_identities(id, user_id, provider, provider_subject, updated_at) VALUES($1::uuid, $2::uuid, 'uniship', '  padded  ', now())",
      randomUUID(),
      operatorUser2.id,
    ),
  );

  await db.user.delete({ where: { id: operatorUser.id } });
  assert.equal(
    await db.externalIdentity.findUnique({ where: { id: extIdentity.id } }),
    null,
  );
  await db.user.delete({ where: { id: operatorUser2.id } });

  step = "REPEAT_AND_DRIFT";
  const beforeRepeat = await db.user.findMany({
    include: { credential: true },
    orderBy: { id: "asc" },
  });
  command(url.toString(), config, ["migrate", "deploy"]);
  assert.deepEqual(
    await db.user.findMany({
      include: { credential: true },
      orderBy: { id: "asc" },
    }),
    beforeRepeat,
  );
  command(url.toString(), config, [
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    resolve("prisma/schema.prisma"),
    "--exit-code",
  ]);
  console.log(
    "Real Prisma legacy preservation, Phase 2 external identities migration, constraints, repeat and drift PASS",
  );
} catch {
  console.error(`IDENTITY_MIGRATION_TEST_FAILED step=${step}`);
  process.exitCode = 1;
} finally {
  for (const client of clients) await client.$disconnect();
  for (const name of owned)
    await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
  await admin.$disconnect();
  if (work) await rm(work, { recursive: true, force: true });
}
