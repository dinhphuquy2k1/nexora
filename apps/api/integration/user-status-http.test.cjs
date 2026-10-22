const { loginWithMfa } = require("../test/helpers/mfa-fixture.cjs");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve, join } = require("node:path");
const { tmpdir } = require("node:os");
const { mkdtemp, rm } = require("node:fs/promises");
const { createDatabase, hashPassword } = require("@nexora/database");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const { loadConfig } = require("../dist/config");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const {
  UserManagementAdapter,
} = require("../dist/identity/infrastructure/user-management.adapter");
const digest = (s) => createHash("sha256").update(s).digest("hex");
const secret = () => randomBytes(32).toString("hex");
const fields = [
  "id",
  "username",
  "role",
  "status",
  "hasPassword",
  "createdAt",
  "updatedAt",
].sort();
function summary(user, expected) {
  assert.deepEqual(Object.keys(user).sort(), fields);
  assert.equal(typeof user.hasPassword, "boolean");
  assert.ok(
    Number.isFinite(Date.parse(user.createdAt)) &&
      Number.isFinite(Date.parse(user.updatedAt)),
  );
  for (const [key, value] of Object.entries(expected))
    assert.equal(user[key], value);
}

test(
  "USER_STATUS_ADMIN_CONTRACT full real Nest HTTP / isolated PostgreSQL matrix",
  { timeout: 120000 },
  async (t) => {
    assert.ok(process.env.DATABASE_URL);
    const saved = {
      DATABASE_URL: process.env.DATABASE_URL,
      STORAGE_ROOT: process.env.STORAGE_ROOT,
    };
    const admin = createDatabase(saved.DATABASE_URL);
    const name = "nexora_http_status_" + randomUUID().replaceAll("-", "");
    const url = new URL(saved.DATABASE_URL);
    url.pathname = "/" + name;
    const root = await mkdtemp(join(tmpdir(), "nexora-status-http-"));
    let owned = false,
      app,
      identity,
      management;
    let stage = "CREATE_DATABASE";
    try {
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      owned = true;
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
      stage = "FIXTURES_AND_HTTP_MATRIX";
      identity = new IdentityDatabaseAdapter(url.toString());
      management = new UserManagementAdapter(url.toString());
      const db = identity.client,
        password = "StatusHttpFixturePassword!",
        hash = await hashPassword(password);
      const [a, b, op] = await Promise.all(
        ["admin-a", "admin-b", "operator"].map((username) =>
          db.user.create({
            data: {
              username,
              role: username === "operator" ? "OPERATOR" : "ADMIN",
              status: "ACTIVE",
              credential: { create: { passwordHash: hash } },
            },
          }),
        ),
      );
      const session = async (user) =>
        (await loginWithMfa(identity, user.username, password)).token;
      let cookieA = await session(a),
        cookieB = await session(b);
      const cookieOp = await session(op);
      process.env.DATABASE_URL = url.toString();
      process.env.STORAGE_ROOT = root;
      app = await NestFactory.create(AppModule, {
        logger: false,
        abortOnError: false,
      });
      configure(app);
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl(),
        origin = loadConfig(process.env).trustedOrigins[0];
      const request = async (
        path,
        token,
        { method = "GET", body, requestOrigin = origin } = {},
      ) => {
        const res = await fetch(base + path, {
          method,
          headers: {
            ...(token ? { cookie: "nexora_session=" + token } : {}),
            ...(requestOrigin ? { origin: requestOrigin } : {}),
            "content-type": "application/json",
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        return { res, body: await res.json() };
      };
      const error = (result, status, code) => {
        assert.equal(result.res.status, status);
        assert.equal(result.body.code, code);
        assert.deepEqual(Object.keys(result.body).sort(), [
          "code",
          "message",
          "requestId",
        ]);
        assert.equal(typeof result.body.message, "string");
        assert.ok(result.body.message.length > 0);
        assert.equal(
          result.body.requestId,
          result.res.headers.get("x-request-id"),
        );
        assert.ok(result.body.requestId);
      };
      const patch = (id, token, body, options = {}) =>
        request("/api/admin/users/" + id + "/status", token, {
          method: "PATCH",
          body,
          ...options,
        });
      const changed = (r, user, status) => {
        assert.equal(r.res.status, 200);
        assert.deepEqual(Object.keys(r.body), ["user"]);
        summary(r.body.user, {
          id: user.id,
          username: user.username,
          role: user.role,
          status,
        });
      };
      await t.test(
        "GET: unauthenticated 401, OPERATOR 403, ADMIN exact seven-field summaries",
        async () => {
          error(await request("/api/admin/users"), 401, "UNAUTHORIZED");
          error(await request("/api/admin/users", cookieOp), 403, "FORBIDDEN");
          const result = await request("/api/admin/users", cookieA);
          assert.equal(result.res.status, 200);
          assert.deepEqual(Object.keys(result.body), ["users"]);
          assert.equal(result.body.users.length, 3);
          for (const user of result.body.users)
            summary(user, { hasPassword: true, status: "ACTIVE" });
        },
      );
      await t.test(
        "PATCH: missing session, OPERATOR and missing/invalid Origin",
        async () => {
          error(
            await patch(op.id, undefined, { status: "DISABLED" }),
            401,
            "UNAUTHORIZED",
          );
          error(
            await patch(op.id, cookieOp, { status: "DISABLED" }),
            403,
            "FORBIDDEN",
          );
          error(
            await patch(
              op.id,
              cookieA,
              { status: "DISABLED" },
              { requestOrigin: null },
            ),
            403,
            "FORBIDDEN",
          );
          error(
            await patch(
              op.id,
              cookieA,
              { status: "DISABLED" },
              { requestOrigin: "https://invalid.example" },
            ),
            403,
            "FORBIDDEN",
          );
        },
      );
      await t.test(
        "PATCH: invalid status, role/extra fields, malformed id and missing user",
        async () => {
          for (const body of [
            { status: "INVALID" },
            { status: null },
            { status: 1 },
            { status: "ACTIVE", role: "ADMIN" },
            { status: "ACTIVE", extra: true },
            { role: "ADMIN" },
            {},
          ])
            error(await patch(op.id, cookieA, body), 400, "VALIDATION_ERROR");
          error(
            await patch("invalid-id", cookieA, { status: "DISABLED" }),
            400,
            "VALIDATION_ERROR",
          );
          error(
            await patch(randomUUID(), cookieA, { status: "DISABLED" }),
            404,
            "NOT_FOUND",
          );
          assert.equal(
            (await db.user.findUnique({ where: { id: op.id } })).status,
            "ACTIVE",
          );
        },
      );
      await t.test(
        "disable OPERATOR revokes sessions/setup tokens; reactivate restores neither",
        async () => {
          const setupToken = secret(),
            target = await management.createOperator(
              a.id,
              "pending-operator",
              digest(setupToken),
              new Date(Date.now() + 86400000),
            );
          const old = secret();
          await identity.createSession(
            target.id,
            digest(old),
            new Date(Date.now() + 86400000),
          );
          const result = await patch(target.id, cookieA, {
            status: "DISABLED",
          });
          changed(result, { ...target, role: "OPERATOR" }, "DISABLED");
          assert.equal(result.body.user.hasPassword, false);
          assert.equal(
            await db.session.count({ where: { userId: target.id } }),
            0,
          );
          assert.equal(
            await db.operatorSetupToken.count({
              where: { userId: target.id, consumedAt: null },
            }),
            0,
          );
          error(await request("/api/auth/session", old), 401, "UNAUTHORIZED");
          changed(
            await patch(target.id, cookieA, { status: "ACTIVE" }),
            { ...target, role: "OPERATOR" },
            "ACTIVE",
          );
          error(await request("/api/auth/session", old), 401, "UNAUTHORIZED");
          assert.equal(
            await db.session.count({ where: { userId: target.id } }),
            0,
          );
          assert.equal(
            await db.operatorSetupToken.count({
              where: { userId: target.id, consumedAt: null },
            }),
            0,
          );
          const setup = await request("/api/auth/setup-password", undefined, {
            method: "POST",
            body: { token: setupToken, password },
          });
          error(setup, 400, "INVALID_OR_EXPIRED_SETUP_TOKEN");
          assert.equal(
            await db.userCredential.count({ where: { userId: target.id } }),
            0,
          );
        },
      );
      await t.test(
        "configured OPERATOR disable/reactivate revokes its local session",
        async () => {
          const result = await patch(op.id, cookieA, { status: "DISABLED" });
          changed(result, op, "DISABLED");
          assert.equal(result.body.user.hasPassword, true);
          error(
            await request("/api/auth/session", cookieOp),
            401,
            "UNAUTHORIZED",
          );
          changed(
            await patch(op.id, cookieA, { status: "ACTIVE" }),
            op,
            "ACTIVE",
          );
          error(
            await request("/api/auth/session", cookieOp),
            401,
            "UNAUTHORIZED",
          );
          assert.equal(await db.session.count({ where: { userId: op.id } }), 0);
        },
      );
      await t.test(
        "ADMIN self-disable, other-admin disable, reactivation and last-admin 409",
        async () => {
          changed(
            await patch(a.id, cookieA, { status: "DISABLED" }),
            a,
            "DISABLED",
          );
          error(
            await request("/api/admin/users", cookieA),
            401,
            "UNAUTHORIZED",
          );
          assert.equal(await db.session.count({ where: { userId: a.id } }), 0);
          changed(
            await patch(a.id, cookieB, { status: "ACTIVE" }),
            a,
            "ACTIVE",
          );
          error(
            await request("/api/admin/users", cookieA),
            401,
            "UNAUTHORIZED",
          );
          cookieA = await session(a);
          changed(
            await patch(b.id, cookieA, { status: "DISABLED" }),
            b,
            "DISABLED",
          );
          error(
            await request("/api/admin/users", cookieB),
            401,
            "UNAUTHORIZED",
          );
          error(
            await patch(a.id, cookieA, { status: "DISABLED" }),
            409,
            "LAST_ACTIVE_ADMIN",
          );
          assert.equal(
            (await db.user.findUnique({ where: { id: a.id } })).status,
            "ACTIVE",
          );
          assert.equal(
            (await request("/api/admin/users", cookieA)).res.status,
            200,
          );
          changed(
            await patch(b.id, cookieA, { status: "ACTIVE" }),
            b,
            "ACTIVE",
          );
          cookieB = await session(b);
        },
      );
      await t.test(
        "two concurrent ADMIN self-disable HTTP requests: one 200, one 409 LAST_ACTIVE_ADMIN",
        async () => {
          const results = await Promise.all([
            patch(a.id, cookieA, { status: "DISABLED" }),
            patch(b.id, cookieB, { status: "DISABLED" }),
          ]);
          assert.deepEqual(results.map((r) => r.res.status).sort(), [200, 409]);
          for (let i = 0; i < 2; i++) {
            const user = [a, b][i],
              cookie = [cookieA, cookieB][i];
            if (results[i].res.status === 200) {
              changed(results[i], user, "DISABLED");
              error(
                await request("/api/admin/users", cookie),
                401,
                "UNAUTHORIZED",
              );
            } else {
              error(results[i], 409, "LAST_ACTIVE_ADMIN");
              assert.equal(
                (await request("/api/admin/users", cookie)).res.status,
                200,
              );
            }
          }
          assert.equal(
            await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
            1,
          );
        },
      );
    } catch {
      throw new Error("USER_STATUS_HTTP_TEST_FAILED stage=" + stage);
    } finally {
      if (app) await app.close();
      for (const x of [identity, management])
        if (x) await x.onApplicationShutdown();
      for (const [key, value] of Object.entries(saved))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      if (owned) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
      await admin.$disconnect();
      await rm(root, { recursive: true, force: true });
    }
  },
);
