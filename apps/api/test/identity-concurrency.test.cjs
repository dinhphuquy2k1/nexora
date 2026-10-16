const { loginWithMfa } = require("./helpers/mfa-fixture.cjs");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const { createDatabase, hashPassword } = require("@nexora/database");
const {
  UserManagementAdapter,
} = require("../dist/identity/infrastructure/user-management.adapter");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const { AuthService } = require("../dist/identity/application/auth.service");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const secret = () => randomBytes(32).toString("hex");
const expiration = () => new Date(Date.now() + 86400000);
const successes = (r) => r.filter((x) => x.status === "fulfilled").length;

test(
  "isolated PostgreSQL onboarding, RBAC, atomic revocation and real transaction races",
  { timeout: 120000 },
  async () => {
    assert.ok(process.env.DATABASE_URL);
    const originalUrl = process.env.DATABASE_URL;
    const originalOrigins = process.env.WEB_ORIGINS;
    const admin = createDatabase(originalUrl);
    const name = "nexora_races_" + randomUUID().replaceAll("-", "");
    const url = new URL(originalUrl);
    url.pathname = "/" + name;
    let a, b, identity, app;
    let stage = "CREATE_DATABASE";
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      execFileSync(
        process.execPath,
        [
          resolve("../../packages/database/node_modules/prisma/build/cli.js"),
          "migrate",
          "deploy",
          "--config",
          resolve("../../packages/database/prisma.config.ts"),
        ],
        {
          env: { ...process.env, DATABASE_URL: url.toString() },
          stdio: "pipe",
          timeout: 60000,
        },
      );
      a = new UserManagementAdapter(url.toString());
      b = new UserManagementAdapter(url.toString());
      identity = new IdentityDatabaseAdapter(url.toString());
      const db = a.client;
      const password = "RaceFixturePassword!";
      const hash = await hashPassword(password);
      const admins = await Promise.all(
        [0, 1].map((i) =>
          db.user.create({
            data: {
              username: "race-admin-" + i,
              role: "ADMIN",
              status: "ACTIVE",
              credential: { create: { passwordHash: hash } },
            },
          }),
        ),
      );
      const actor = admins[0].id;
      const operator = async () => {
        const token = secret();
        const u = await a.createOperator(
          actor,
          "race-" + randomUUID(),
          token,
          expiration(),
        );
        return { ...u, token };
      };
      stage = "LOCAL_LOGIN_AND_SETUP";
      const auth = new AuthService(identity);
      await loginWithMfa(identity, admins[0].username, password);
      const first = await operator();
      await a.consume(first.token, hash);
      await auth.login(first.username, password);
      await assert.rejects(a.consume(first.token, hash));
      await assert.rejects(a.reissue(actor, first.id, secret(), expiration()));
      const missing = await operator();
      const before = await db.session.count();
      await assert.rejects(auth.login(missing.username, password));
      await assert.rejects(auth.login(first.username, "wrong-password"));
      assert.equal(await db.session.count(), before);
      const expired = await operator();
      await db.operatorSetupToken.updateMany({
        where: { userId: expired.id },
        data: { expiresAt: new Date(0) },
      });
      await assert.rejects(a.consume(expired.token, hash));
      const reissued = await operator();
      const replacement = secret();
      await a.reissue(actor, reissued.id, replacement, expiration());
      await assert.rejects(a.consume(reissued.token, hash));
      await a.consume(replacement, hash);
      stage = "SESSION_ISSUANCE_RECHECK";
      for (const mutation of ["disable", "password"]) {
        const u = await operator();
        await a.consume(u.token, hash);
        let verified, release;
        const verifiedSignal = new Promise((r) => (verified = r));
        const gate = new Promise((r) => (release = r));
        const adapter = new IdentityDatabaseAdapter(url.toString());
        const verify = adapter.verifyPassword.bind(adapter);
        adapter.verifyPassword = async (...args) => {
          const result = await verify(...args);
          verified();
          await gate;
          return result;
        };
        const pending = new AuthService(adapter).login(u.username, password);
        await verifiedSignal;
        if (mutation === "disable") await a.setStatus(actor, u.id, "DISABLED");
        else
          await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id=${u.id}::uuid FOR UPDATE`;
            await tx.userCredential.update({
              where: { userId: u.id },
              data: {
                passwordHash: await hashPassword("ChangedFixturePassword!"),
              },
            });
          });
        release();
        await assert.rejects(pending);
        assert.equal(await db.session.count({ where: { userId: u.id } }), 0);
        await adapter.onApplicationShutdown();
      }
      stage = "TOKEN_CONCURRENCY";
      const double = await operator();
      assert.equal(
        successes(
          await Promise.allSettled([
            a.consume(double.token, hash),
            b.consume(double.token, hash),
          ]),
        ),
        1,
      );
      assert.equal(
        await db.userCredential.count({ where: { userId: double.id } }),
        1,
      );
      const issueRace = await operator();
      const newToken = secret();
      const outcome = await Promise.allSettled([
        a.consume(issueRace.token, hash),
        b.reissue(actor, issueRace.id, newToken, expiration()),
      ]);
      assert.equal(successes(outcome), 1);
      await assert.rejects(a.consume(issueRace.token, hash));
      if (outcome[1].status === "fulfilled") await a.consume(newToken, hash);
      const disableRace = await operator();
      await identity.createSession(disableRace.id, secret(), expiration());
      const race = await Promise.allSettled([
        a.consume(disableRace.token, hash),
        b.setStatus(actor, disableRace.id, "DISABLED"),
      ]);
      assert.equal(race[1].status, "fulfilled");
      assert.equal(
        await db.session.count({ where: { userId: disableRace.id } }),
        0,
      );
      assert.equal(
        await db.operatorSetupToken.count({
          where: { userId: disableRace.id, consumedAt: null },
        }),
        0,
      );
      await a.setStatus(actor, disableRace.id, "ACTIVE");
      await assert.rejects(a.consume(disableRace.token, hash));
      assert.equal(
        await db.session.count({ where: { userId: disableRace.id } }),
        0,
      );
      stage = "ATOMIC_DISABLE_ROLLBACK";
      const rollback = await operator();
      await identity.createSession(rollback.id, secret(), expiration());
      await db.$executeRawUnsafe(
        "CREATE FUNCTION reject_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture revoke failure'; END $$",
      );
      await db.$executeRawUnsafe(
        "CREATE TRIGGER reject_revoke BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION reject_session_delete()",
      );
      await assert.rejects(a.setStatus(actor, rollback.id, "DISABLED"));
      assert.equal(
        (await db.user.findUnique({ where: { id: rollback.id } })).status,
        "ACTIVE",
      );
      assert.equal(
        await db.operatorSetupToken.count({
          where: { userId: rollback.id, consumedAt: null },
        }),
        1,
      );
      assert.equal(
        await db.session.count({ where: { userId: rollback.id } }),
        1,
      );
      await db.$executeRawUnsafe("DROP TRIGGER reject_revoke ON sessions");
      await db.$executeRawUnsafe("DROP FUNCTION reject_session_delete()");
      stage = "HTTP_RBAC";
      process.env.DATABASE_URL = url.toString();
      // Reuse canonical configured trusted origin; never expose the disposable DB URL.
      app = await NestFactory.create(AppModule, { logger: false });
      configure(app);
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl();
      const { loadConfig } = require("../dist/config");
      const origin = loadConfig(process.env).trustedOrigins[0];
      const adminSession = await loginWithMfa(
        identity,
        admins[0].username,
        password,
      );
      const opSession = await auth.login(first.username, password);
      const request = (route, token, method = "GET", body) =>
        fetch(base + route, {
          method,
          headers: {
            ...(token ? { cookie: "nexora_session=" + token } : {}),
            origin,
            "content-type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });
      assert.equal((await request("/api/admin/users")).status, 401);
      assert.equal(
        (await request("/api/admin/users", opSession.token)).status,
        403,
      );
      const listing = await request("/api/admin/users", adminSession.token);
      assert.equal(listing.status, 200);
      const payload = await listing.json();
      assert.ok(
        payload.users.every(
          (u) =>
            Object.keys(u).sort().join(",") ===
            "createdAt,hasPassword,id,role,status,updatedAt,username",
        ),
      );
      assert.equal(
        (await request("/api/auth/provider/login", undefined, "POST", {}))
          .status,
        404,
      );
      assert.equal(
        (
          await request("/api/admin/operators", adminSession.token, "POST", {
            username: "forged",
            role: "ADMIN",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await fetch(base + "/api/admin/operators", {
            method: "POST",
            headers: {
              cookie: "nexora_session=" + adminSession.token,
              "content-type": "application/json",
            },
            body: JSON.stringify({ username: "missing-origin" }),
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(
            "/api/admin/users/" + first.id + "/status",
            adminSession.token,
            "PATCH",
            { status: "DISABLED" },
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("/api/admin/users", opSession.token)).status,
        401,
      );
      stage = "LAST_ACTIVE_ADMIN_RACE";
      const final = await Promise.allSettled([
        a.setStatus(admins[0].id, admins[0].id, "DISABLED"),
        b.setStatus(admins[1].id, admins[1].id, "DISABLED"),
      ]);
      assert.equal(successes(final), 1);
      assert.equal(
        final.find((x) => x.status === "rejected").reason.code,
        "LAST_ACTIVE_ADMIN",
      );
      assert.equal(
        await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
        1,
      );
    } catch {
      throw new Error("IDENTITY_POSTGRES_TEST_FAILED stage=" + stage);
    } finally {
      if (app) await app.close();
      for (const adapter of [a, b, identity])
        if (adapter) await adapter.onApplicationShutdown();
      process.env.DATABASE_URL = originalUrl;
      if (originalOrigins === undefined) delete process.env.WEB_ORIGINS;
      else process.env.WEB_ORIGINS = originalOrigins;
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}"`);
      await admin.$disconnect();
    }
  },
);
