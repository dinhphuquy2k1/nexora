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
  CarrierAdapter,
} = require("../dist/carrier/infrastructure/carrier.adapter");
const {
  CarrierSecretWriter,
} = require("../dist/carrier/infrastructure/carrier-secret-writer");
const { SecretCipher } = require("../dist/common/crypto/secret-cipher");
const {
  UserManagementAdapter,
} = require("../dist/identity/infrastructure/user-management.adapter");
const { AuthService } = require("../dist/identity/application/auth.service");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const keys = new Map([[1, randomBytes(32)]]);
const cipher = new SecretCipher({
  activeVersion: () => 1,
  key: (v) => keys.get(v),
});
const metadata = [
  "id",
  "provider",
  "externalAccountId",
  "loginIdentifier",
  "displayName",
  "status",
  "lastVerifiedAt",
  "createdAt",
].sort();
test(
  "Carrier foundation real PostgreSQL / Nest HTTP / concurrency",
  { timeout: 180000 },
  async (t) => {
    assert.ok(process.env.DATABASE_URL);
    const saved = {
      DATABASE_URL: process.env.DATABASE_URL,
      STORAGE_ROOT: process.env.STORAGE_ROOT,
      CARRIER_KEYRING_JSON: process.env.CARRIER_KEYRING_JSON,
      CARRIER_ACTIVE_KEY_VERSION: process.env.CARRIER_ACTIVE_KEY_VERSION,
    };
    const admin = createDatabase(saved.DATABASE_URL),
      name = "nexora_carrier_" + randomUUID().replaceAll("-", "");
    const url = new URL(saved.DATABASE_URL);
    url.pathname = "/" + name;
    const root = await mkdtemp(join(tmpdir(), "nexora-carrier-"));
    let owned = false,
      db,
      app,
      management,
      carrier,
      identity;
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
      db = createDatabase(url.toString());
      // Only db/admin are privileged fixture connections. Every application adapter
      // and the HTTP app below authenticates using the actual restricted secret.
      const { readFile } = require("node:fs/promises");
      const { provisionRuntime, runtimeUrl } = await import(
        "../../../packages/database/scripts/provision-runtime.mjs"
      );
      const { assertRuntimePrivileges } = await import(
        "../../../packages/database/test/runtime-privilege-assertions.mjs"
      );
      const runtimePassword = (
        await readFile("/runtime-config/postgres_app_password", "utf8")
      ).trim();
      await provisionRuntime(url.toString(), runtimePassword);
      await assertRuntimePrivileges(url.toString(), runtimePassword);
      const applicationUrl = runtimeUrl(url.toString(), runtimePassword);

      identity = new IdentityDatabaseAdapter(applicationUrl);
      management = new UserManagementAdapter(applicationUrl);
      carrier = new CarrierAdapter(applicationUrl);
      const writer = new CarrierSecretWriter(db, cipher),
        password = "CarrierFixture-LocalPassword!",
        hash = await hashPassword(password);
      const users = await Promise.all(
        ["a", "b", "admin", "admin2"].map((n) =>
          db.user.create({
            data: {
              username: "carrier-" + n,
              role: n.startsWith("admin") ? "ADMIN" : "OPERATOR",
              status: "ACTIVE",
              credential: { create: { passwordHash: hash } },
            },
          }),
        ),
      );
      const [a, b, actor, otherAdmin] = users;
      const connection = (userId, extra = {}) =>
        db.carrierConnection.create({
          data: {
            userId,
            provider: "uniship",
            externalAccountId: randomUUID(),
            displayName: "Branch",
            status: "CONNECTED",
            ...extra,
          },
        });
      const ca = await connection(a.id),
        ca2 = await connection(a.id),
        cb = await connection(b.id),
        retained = await connection(b.id);
      await writer.write(b.id, retained.id, "PASSWORD", "retained-fixture");
      await writer.write(a.id, ca.id, "ACCESS_TOKEN", "fixture-token");
      await writer.write(a.id, ca.id, "PASSWORD", "fixture-carrier-password");
      const tokens = await Promise.all(
        users.map((u) =>
          new AuthService(identity)
            .login(u.username, password)
            .then((r) => r.token),
        ),
      );
      process.env.DATABASE_URL = applicationUrl;
      process.env.STORAGE_ROOT = root;
      process.env.CARRIER_KEYRING_JSON = "invalid-fixture-config";
      process.env.CARRIER_ACTIVE_KEY_VERSION = "1";
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
        token = tokens[0],
        method = "GET",
        body,
        requestOrigin = origin,
      ) => {
        const res = await fetch(base + path, {
          method,
          headers: {
            ...(token ? { cookie: "nexora_session=" + token } : {}),
            ...(requestOrigin ? { origin: requestOrigin } : {}),
            "content-type": "application/json",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        const value = await res.json();
        assert.ok(
          !/ciphertext|authTag|nonce|fixture-token|fixture-carrier-password/.test(
            JSON.stringify(value),
          ),
        );
        return { status: res.status, body: value };
      };
      const error = (r, status, code) => {
        assert.equal(r.status, status);
        assert.equal(r.body.code, code);
        assert.deepEqual(Object.keys(r.body).sort(), [
          "code",
          "message",
          "requestId",
        ]);
      };
      stage = "HTTP";
      await t.test(
        "invalid/missing Carrier key leaves local HTTP Login, ADMIN and metadata functional",
        async () => {
          const {
            SecretCipher,
          } = require("../dist/common/crypto/secret-cipher");
          assert.throws(() =>
            app.get(SecretCipher).encrypt("CARRIER_TOKEN", "context", "value"),
          );
          const login = await request("/api/auth/login", null, "POST", {
            username: a.username,
            password,
          });
          assert.equal(login.status, 200);
          assert.equal(
            (await request("/api/admin/users", tokens[2])).status,
            200,
          );
          assert.equal((await request("/api/carrier-connections")).status, 200);
          const {
            EnvironmentKeyring,
          } = require("../dist/common/crypto/environment-keyring");
          const missing = new SecretCipher(new EnvironmentKeyring({}));
          const before = await db.carrierConnectionSecret.findMany({
            where: { connectionId: retained.id },
          });
          await assert.rejects(
            new CarrierSecretWriter(db, missing).write(
              b.id,
              retained.id,
              "PASSWORD",
              "never-persist",
            ),
          );
          assert.deepEqual(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: retained.id },
            }),
            before,
          );
          assert.equal(
            (
              await db.carrierConnection.findUnique({
                where: { id: retained.id },
              })
            ).status,
            "CONNECTED",
          );
        },
      );

      await t.test(
        "session, exact metadata ownership, admin has no cross-user exception",
        async () => {
          for (const p of ["/api/carriers", "/api/carrier-connections"])
            error(await request(p, null), 401, "UNAUTHORIZED");
          const providers = await request("/api/carriers");
          assert.equal(providers.status, 200);
          assert.deepEqual(providers.body, {
            carriers: [{ provider: "uniship", displayName: "Uniship" }],
          });
          const own = await request("/api/carrier-connections?user_id=" + b.id);
          assert.equal(own.status, 200);
          assert.deepEqual(
            own.body.connections.map((c) => c.id).sort(),
            [ca.id, ca2.id].sort(),
          );
          for (const c of own.body.connections)
            assert.deepEqual(Object.keys(c).sort(), metadata);
          assert.deepEqual(
            (await request("/api/carrier-connections", tokens[2])).body,
            { connections: [] },
          );
          for (const token of [tokens[1], tokens[2]])
            for (const method of ["PATCH", "DELETE"])
              error(
                await request(
                  "/api/carrier-connections/" + ca.id,
                  token,
                  method,
                  method === "PATCH" ? { displayName: "x" } : undefined,
                ),
                404,
                "NOT_FOUND",
              );
        },
      );
      await t.test(
        "strict PATCH, UUID, Origin, DELETE cascade and PR4 route absence",
        async () => {
          const path = "/api/carrier-connections/" + ca.id;
          for (const body of [
            {},
            null,
            [],
            { displayName: 1 },
            { displayName: " " },
            { displayName: "x".repeat(101) },
            { displayName: "x", userId: b.id },
            { displayName: "x", provider: "other" },
            { status: "ERROR" },
            { password: "x" },
            { externalAccountId: "x" },
          ])
            error(
              await request(path, tokens[0], "PATCH", body),
              400,
              "VALIDATION_ERROR",
            );
          for (const method of ["PATCH", "DELETE"]) {
            error(
              await request(
                path,
                tokens[0],
                method,
                method === "PATCH" ? { displayName: "x" } : undefined,
                null,
              ),
              403,
              "FORBIDDEN",
            );
            error(
              await request(
                path,
                tokens[0],
                method,
                method === "PATCH" ? { displayName: "x" } : undefined,
                "https://bad.example",
              ),
              403,
              "FORBIDDEN",
            );
          }
          error(
            await request("/api/carrier-connections/bad", tokens[0], "PATCH", {
              displayName: "x",
            }),
            400,
            "VALIDATION_ERROR",
          );
          error(
            await request(
              "/api/carrier-connections/" + randomUUID(),
              tokens[0],
              "DELETE",
            ),
            404,
            "NOT_FOUND",
          );
          const renamed = await request(path, tokens[0], "PATCH", {
            displayName: "Updated",
          });
          assert.equal(renamed.status, 200);
          assert.equal(renamed.body.connection.displayName, "Updated");
          assert.deepEqual(
            Object.keys(renamed.body.connection).sort(),
            metadata,
          );
          const row = await db.carrierConnection.findUnique({
            where: { id: ca.id },
          });
          assert.equal(row.userId, a.id);
          assert.equal(row.provider, "uniship");
          assert.equal(row.externalAccountId, ca.externalAccountId);
          assert.deepEqual(await request(path, tokens[0], "DELETE"), {
            status: 200,
            body: { success: true },
          });
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connectionId: ca.id },
            }),
            0,
          );
          error(
            await request("/api/carrier-connections", tokens[0], "POST", {}),
            400,
            "VALIDATION_ERROR",
          );
          error(
            await request(path + "/reconnect", tokens[0], "POST", {}),
            400,
            "VALIDATION_ERROR",
          );
        },
      );
      stage = "CONSTRAINTS";
      await t.test(
        "CHECK, FK, unique and cascade constraints on real database",
        async () => {
          for (const extra of [{ provider: "other" }, { status: "OTHER" }])
            await assert.rejects(connection(a.id, extra));
          const duplicate = await Promise.allSettled([
            connection(a.id, { externalAccountId: "global-account" }),
            connection(b.id, { externalAccountId: "global-account" }),
          ]);
          assert.equal(
            duplicate.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const c = await connection(a.id, { loginIdentifier: null });
          assert.equal(c.loginIdentifier, null);
          await writer.write(a.id, c.id, "REFRESH_TOKEN", "refresh");
          const encrypted = await db.carrierConnectionSecret.findFirst({
            where: { connectionId: c.id },
          });
          assert.ok(!encrypted.ciphertext.includes("refresh"));
          await assert.rejects(
            db.carrierConnectionSecret.create({
              data: {
                connectionId: c.id,
                secretType: "OTHER",
                ciphertext: "",
                nonce: "",
                authTag: "",
                keyVersion: 1,
              },
            }),
          );
          await assert.rejects(
            db.carrierConnectionSecret.create({
              data: {
                connectionId: c.id,
                secretType: "REFRESH_TOKEN",
                ciphertext: encrypted.ciphertext,
                nonce: encrypted.nonce,
                authTag: encrypted.authTag,
                keyVersion: 1,
              },
            }),
          );
          await assert.rejects(connection(randomUUID()));
          await assert.rejects(
            db.carrierConnectionSecret.create({
              data: {
                connectionId: randomUUID(),
                secretType: "PASSWORD",
                ciphertext: encrypted.ciphertext,
                nonce: encrypted.nonce,
                authTag: encrypted.authTag,
                keyVersion: 1,
              },
            }),
          );
          const transient = await db.user.create({
              data: { username: "cascade", role: "OPERATOR" },
            }),
            cc = await connection(transient.id);
          await writer.write(
            transient.id,
            cc.id,
            "PASSWORD",
            "cascade-password",
          );
          await db.user.delete({ where: { id: transient.id } });
          assert.equal(
            await db.carrierConnection.count({ where: { id: cc.id } }),
            0,
          );
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connectionId: cc.id },
            }),
            0,
          );
        },
      );
      stage = "DISABLE";
      await t.test(
        "failure rolls back user, session, setup tokens, secrets and connection status",
        async () => {
          await writer.write(b.id, cb.id, "PASSWORD", "rollback-value");
          await db.operatorSetupToken.create({
            data: {
              userId: b.id,
              issuedBy: actor.id,
              tokenHash: createHash("sha256")
                .update(randomBytes(32))
                .digest("hex"),
              expiresAt: new Date(Date.now() + 86400000),
            },
          });
          const snapshot = async () => ({
            user: await db.user.findUnique({ where: { id: b.id } }),
            sessions: await db.session.findMany({ where: { userId: b.id } }),
            setup: await db.operatorSetupToken.findMany({
              where: { userId: b.id },
            }),
            connection: await db.carrierConnection.findUnique({
              where: { id: cb.id },
            }),
            secrets: await db.carrierConnectionSecret.findMany({
              where: { connectionId: cb.id },
            }),
          });
          const before = await snapshot();
          await db.$executeRawUnsafe(
            "CREATE FUNCTION fail_carrier_status() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled carrier rollback'; END $$",
          );
          await db.$executeRawUnsafe(
            "CREATE TRIGGER fail_carrier_status BEFORE UPDATE ON carrier_connections FOR EACH ROW EXECUTE FUNCTION fail_carrier_status()",
          );
          try {
            await assert.rejects(
              management.setStatus(actor.id, b.id, "DISABLED"),
            );
            assert.deepEqual(await snapshot(), before);
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER fail_carrier_status ON carrier_connections",
            );
            await db.$executeRawUnsafe("DROP FUNCTION fail_carrier_status()");
          }
        },
      );
      await t.test(
        "disable versus metadata/delete/internal writes serializes without credential resurrection",
        async () => {
          // Hold the real target user lock so all operations are genuinely concurrent waiters.
          let release, locked;
          const ready = new Promise((r) => (locked = r)),
            gate = new Promise((r) => (release = r));
          const held = db.$transaction(
            async (tx) => {
              await tx.$queryRaw`SELECT id FROM users WHERE id=${b.id}::uuid FOR UPDATE`;
              locked();
              await gate;
            },
            { timeout: 15000 },
          );
          await ready;
          const outcomesPromise = Promise.allSettled([
            management.setStatus(actor.id, b.id, "DISABLED"),
            writer.write(b.id, cb.id, "ACCESS_TOKEN", "late-token"),
            carrier.rename(b.id, cb.id, "Concurrent"),
            carrier.remove(b.id, cb.id),
          ]);
          let waiters = 0;
          try {
            for (let attempt = 0; attempt < 200; attempt++) {
              const rows =
                await db.$queryRaw`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND pid<>pg_backend_pid()`;
              waiters = rows[0].count;
              if (waiters >= 4) break;
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
          } finally {
            release();
          }
          await held;
          assert.ok(
            waiters >= 4,
            "four independent transactions must actually wait on the held user lock",
          );
          const outcomes = await outcomesPromise;
          assert.equal(outcomes[0].status, "fulfilled");
          for (const result of outcomes)
            if (result.status === "rejected")
              assert.ok(
                ["UNAUTHORIZED", "NOT_FOUND"].includes(result.reason.code),
              );
          assert.equal(
            (await db.user.findUnique({ where: { id: b.id } })).status,
            "DISABLED",
          );
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connection: { userId: b.id } },
            }),
            0,
          );
          for (const c of await db.carrierConnection.findMany({
            where: { userId: b.id },
          }))
            assert.equal(c.status, "REAUTH_REQUIRED");
          await assert.rejects(
            writer.write(b.id, retained.id, "ACCESS_TOKEN", "very-late"),
            (error) => error.code === "UNAUTHORIZED",
          );
          await management.setStatus(actor.id, b.id, "ACTIVE");
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connection: { userId: b.id } },
            }),
            0,
          );
          assert.equal(await db.session.count({ where: { userId: b.id } }), 0);
          assert.equal(
            await db.operatorSetupToken.count({
              where: { userId: b.id, consumedAt: null },
            }),
            0,
          );
        },
      );
      await t.test(
        "simultaneous same-connection mutations and last-active-admin protection",
        async () => {
          const c = await connection(a.id);
          const results = await Promise.allSettled([
            carrier.rename(a.id, c.id, "First"),
            carrier.remove(a.id, c.id),
          ]);
          for (const x of results)
            if (x.status === "rejected")
              assert.equal(x.reason.code, "NOT_FOUND");
          assert.equal(
            await db.carrierConnection.count({ where: { id: c.id } }),
            0,
          );
          const statuses = await Promise.allSettled([
            management.setStatus(actor.id, actor.id, "DISABLED"),
            management.setStatus(otherAdmin.id, otherAdmin.id, "DISABLED"),
          ]);
          assert.equal(
            statuses.filter((x) => x.status === "fulfilled").length,
            1,
          );
          assert.equal(
            statuses.find((x) => x.status === "rejected").reason.code,
            "LAST_ACTIVE_ADMIN",
          );
          assert.equal(
            await db.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
            1,
          );
        },
      );
      console.log("CARRIER_FOUNDATION_HTTP_CONSTRAINTS_CONCURRENCY_PASS");
      await t.test(
        "repeat role provisioning preserves every application row",
        async () => {
          const tables = [
            "users",
            "user_credentials",
            "sessions",
            "operator_setup_tokens",
            "stored_files",
            "carrier_connections",
            "carrier_connection_secrets",
            "carrier_user_states",
            "security_audit_events",
          ];
          const snapshot = async () =>
            Promise.all(
              tables.map((table) =>
                db.$queryRawUnsafe(
                  `SELECT jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text) AS rows FROM ${table} t`,
                ),
              ),
            );
          const before = await snapshot();
          await provisionRuntime(url.toString(), runtimePassword);
          assert.deepEqual(await snapshot(), before);
        },
      );
    } catch {
      throw new Error("CARRIER_FOUNDATION_FAILED stage=" + stage);
    } finally {
      if (app) await app.close();
      for (const x of [identity, management, carrier])
        if (x) await x.onApplicationShutdown();
      if (db) await db.$disconnect();
      for (const [k, v] of Object.entries(saved))
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      if (owned) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
      await admin.$disconnect();
      await rm(root, { recursive: true, force: true });
    }
  },
);
