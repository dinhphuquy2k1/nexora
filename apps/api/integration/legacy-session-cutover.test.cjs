require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve, join } = require("node:path");
const { tmpdir } = require("node:os");
const { mkdtemp, cp, writeFile, rm } = require("node:fs/promises");
const { createDatabase, hashPassword } = require("@nexora/database");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const { AuthService } = require("../dist/identity/application/auth.service");
const digest = (s) => createHash("sha256").update(s).digest("hex");
const migrations = [
  "20261006000000_storage_catalog",
  "20261012000000_local_authentication",
  "20261012010000_unified_identity",
  "20261012020000_external_identities",
];

test(
  "I1 genuine pre-PR2 provider-session cutover investigation",
  { timeout: 120000 },
  async () => {
    assert.ok(process.env.DATABASE_URL);
    const admin = createDatabase(process.env.DATABASE_URL);
    const name = "nexora_cutover_" + randomUUID().replaceAll("-", "");
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = "/" + name;
    const work = await mkdtemp(join(tmpdir(), "nexora-cutover-"));
    const databaseRoot = resolve("../../packages/database");
    let owned = false,
      identity;
    let stage = "BASELINE";
    try {
      const config = join(work, "prisma.config.ts");
      const configModule = require.resolve("prisma/config", {
        paths: [databaseRoot],
      });
      await cp(
        join(databaseRoot, "prisma/schema.prisma"),
        join(work, "schema.prisma"),
      );
      await writeFile(
        config,
        `import {defineConfig} from ${JSON.stringify(configModule)};export default defineConfig({schema:${JSON.stringify(join(work, "schema.prisma"))},migrations:{path:${JSON.stringify(join(work, "migrations"))}},datasource:{url:process.env.DATABASE_URL}});`,
      );
      for (const migration of migrations)
        await cp(
          join(databaseRoot, "prisma/migrations", migration),
          join(work, "migrations", migration),
          { recursive: true },
        );
      await cp(
        join(databaseRoot, "prisma/migrations/migration_lock.toml"),
        join(work, "migrations/migration_lock.toml"),
      );
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      owned = true;
      const deploy = () =>
        execFileSync(
          process.execPath,
          [
            join(databaseRoot, "node_modules/prisma/build/cli.js"),
            "migrate",
            "deploy",
            "--config",
            config,
          ],
          {
            env: { ...process.env, DATABASE_URL: url.toString() },
            stdio: "pipe",
            timeout: 60000,
          },
        );
      deploy();
      identity = new IdentityDatabaseAdapter(url.toString());
      const db = identity.client;
      const hash = await hashPassword("CutoverFixturePassword!");
      const users = await Promise.all(
        [
          {
            username: "cutover-admin",
            role: "ADMIN",
            status: "ACTIVE",
            credential: { create: { passwordHash: hash } },
          },
          {
            username: "cutover-provider-only",
            role: "OPERATOR",
            status: "ACTIVE",
          },
          {
            username: "cutover-configured",
            role: "OPERATOR",
            status: "ACTIVE",
            credential: { create: { passwordHash: hash } },
          },
          {
            username: "cutover-disabled",
            role: "OPERATOR",
            status: "DISABLED",
          },
        ].map((data) => db.user.create({ data })),
      );
      for (const user of users.slice(1))
        await db.$executeRawUnsafe(
          "INSERT INTO external_identities(id,user_id,provider,provider_subject,updated_at) VALUES($1::uuid,$2::uuid,'uniship',$3,now())",
          randomUUID(),
          user.id,
          "subject-" + user.id,
        );
      const tokens = users.map(() => randomBytes(32).toString("hex"));
      for (let i = 0; i < users.length; i++)
        await db.$executeRaw`INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(${randomUUID()}::uuid,${users[i].id}::uuid,${digest(tokens[i])},${new Date(Date.now() + 86400000)})`;
      const expired = randomBytes(32).toString("hex");
      await db.$executeRaw`INSERT INTO sessions(id,user_id,token_hash,expires_at) VALUES(${randomUUID()}::uuid,${users[1].id}::uuid,${digest(expired)},${new Date(0)})`;
      await db.storedFile.create({
        data: { id: randomUUID(), sha256: "c".repeat(64), sizeBytes: 321 },
      });
      const preserved = async () => ({
        users: await db.user.findMany({
          include: { credential: true },
          orderBy: { id: "asc" },
        }),
        files: await db.storedFile.findMany({ orderBy: { id: "asc" } }),
      });
      const before = await preserved();
      const sessions = await db.session.findMany({
        select: {
          id: true,
          tokenHash: true,
          userId: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { id: "asc" },
      });
      // Historical stages have no auth_level. Query their real rows explicitly;
      // do not run the new-schema session adapter against an old schema.
      let auth = new AuthService({
        findSessionByTokenHash: async (tokenHash) => {
          const rows =
            await db.$queryRaw`SELECT s.id,s.user_id,s.expires_at,s.created_at,u.username,u.status FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=${tokenHash}`;
          const row = rows[0];
          return row && row.status === "ACTIVE"
            ? {
                session: {
                  id: row.id,
                  userId: row.user_id,
                  expiresAt: row.expires_at,
                  createdAt: row.created_at,
                },
                user: { id: row.user_id, username: row.username },
              }
            : null;
        },
        deleteSessionByTokenHash: async (tokenHash) => {
          await db.session.deleteMany({ where: { tokenHash } });
        },
      });
      assert.ok(await auth.validateSession(tokens[0]));
      assert.ok(await auth.validateSession(tokens[1]));
      assert.ok(await auth.validateSession(tokens[2]));
      assert.equal(await auth.validateSession(tokens[3]), null);
      stage = "ORIGINAL_PR2_MIGRATION";
      const pr2 = "20261015000000_local_identity_onboarding";
      await cp(
        join(databaseRoot, "prisma/migrations", pr2),
        join(work, "migrations", pr2),
        { recursive: true },
      );
      deploy();
      assert.deepEqual(await preserved(), before);
      assert.deepEqual(
        await db.session.findMany({
          select: {
            id: true,
            tokenHash: true,
            userId: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { id: "asc" },
        }),
        sessions,
      );
      assert.ok(await auth.validateSession(tokens[1]));
      assert.ok(await auth.validateSession(tokens[0]));
      assert.ok(await auth.validateSession(tokens[2]));
      assert.equal(await auth.validateSession(tokens[3]), null);
      assert.equal(
        (
          await db.$queryRawUnsafe(
            "SELECT to_regclass('public.external_identities') IS NULL AS removed",
          )
        )[0].removed,
        true,
      );
      stage = "APPROVED_CREDENTIALLESS_OPERATOR_CUTOVER";
      const cutover = "20261015010000_legacy_provider_session_cutover";
      await cp(
        join(databaseRoot, "prisma/migrations", cutover),
        join(work, "migrations", cutover),
        { recursive: true },
      );
      deploy();
      assert.deepEqual(await preserved(), before);
      assert.equal(await db.session.count(), 2);
      assert.equal(
        await db.session.count({
          where: { userId: { in: [users[1].id, users[3].id] } },
        }),
        0,
      );
      assert.equal(await auth.validateSession(tokens[1]), null);
      assert.equal(await auth.validateSession(tokens[3]), null);
      assert.equal(await auth.validateSession(expired), null);
      assert.ok(await auth.validateSession(tokens[0]));
      assert.ok(await auth.validateSession(tokens[2]));
      stage = "NO_RESURRECTION_AFTER_PASSWORD_SETUP";
      for (const migration of [
        "20261015020000_carrier_connections",
        "20261016000000_carrier_lifecycle",
        "20261016010000_admin_totp_mfa",
      ])
        await cp(
          join(databaseRoot, "prisma/migrations", migration),
          join(work, "migrations", migration),
          { recursive: true },
        );
      deploy();
      auth = new AuthService(identity);
      const {
        UserManagementAdapter,
      } = require("../dist/identity/infrastructure/user-management.adapter");
      const management = new UserManagementAdapter(url.toString());
      try {
        const setup = randomBytes(32).toString("hex");
        await management.reissue(
          users[0].id,
          users[1].id,
          digest(setup),
          new Date(Date.now() + 86400000),
        );
        await management.consume(digest(setup), hash);
        assert.equal(await auth.validateSession(tokens[1]), null);
        const fresh = await auth.login(
          users[1].username,
          "CutoverFixturePassword!",
        );
        assert.ok(await auth.validateSession(fresh.token));
        const retained = await db.session.findMany({
          select: {
            id: true,
            tokenHash: true,
            userId: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { id: "asc" },
        });
        deploy();
        assert.deepEqual(
          await db.session.findMany({
            select: {
              id: true,
              tokenHash: true,
              userId: true,
              expiresAt: true,
              createdAt: true,
            },
            orderBy: { id: "asc" },
          }),
          retained,
        );
      } finally {
        await management.onApplicationShutdown();
      }
      console.log(
        "I1 genuine Prisma REPRO then approved cutover PASS: credentialless OPERATOR sessions revoked; ADMIN/configured sessions and files preserved; no resurrection after setup; repeated deploy preserves fresh local session",
      );
    } catch {
      throw new Error("LEGACY_SESSION_CUTOVER_TEST_FAILED stage=" + stage);
    } finally {
      if (identity) await identity.onApplicationShutdown();
      if (owned) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
      await admin.$disconnect();
      await rm(work, { recursive: true, force: true });
    }
  },
);
