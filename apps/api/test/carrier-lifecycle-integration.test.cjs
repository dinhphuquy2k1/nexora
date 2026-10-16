require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { randomUUID, randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve, join } = require("node:path");
const { tmpdir } = require("node:os");
const { mkdtemp, rm } = require("node:fs/promises");
const { createDatabase, hashPassword } = require("@nexora/database");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const { loadConfig } = require("../dist/config");
const { AuthService } = require("../dist/identity/application/auth.service");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const {
  UserManagementAdapter,
} = require("../dist/identity/infrastructure/user-management.adapter");
const {
  CarrierLifecycleAdapter,
} = require("../dist/carrier/infrastructure/carrier-lifecycle.adapter");
const {
  PostgresSecurityAudit,
} = require("../dist/carrier/infrastructure/security-audit.adapter");
const {
  CarrierCredentialVault,
} = require("../dist/carrier/infrastructure/carrier-credential-vault");
const {
  CarrierConnectionLifecycleService,
} = require("../dist/carrier/application/carrier-connection-lifecycle.service");
const {
  UnishipHttpClient,
} = require("../dist/carrier/infrastructure/uniship/uniship-http.client");
const {
  UnishipAdapter,
} = require("../dist/carrier/infrastructure/uniship/uniship-adapter");
const {
  UserCarrierAdmission,
} = require("../dist/carrier/infrastructure/uniship/provider-budget");
const { SecretCipher } = require("../dist/common/crypto/secret-cipher");
const {
  LifecycleFailure,
  LifecycleCode,
} = require("../dist/carrier/domain/lifecycle");

test(
  "PR4 real PostgreSQL/Nest lifecycle, audit, fencing and lazy recovery",
  { timeout: 180000 },
  async (t) => {
    const saved = { ...process.env };
    const name = "nexora_lifecycle_" + randomUUID().replaceAll("-", "");
    const admin = createDatabase(saved.DATABASE_URL),
      url = new URL(saved.DATABASE_URL);
    url.pathname = "/" + name;
    const root = await mkdtemp(join(tmpdir(), "nexora-lifecycle-"));
    let db,
      app,
      store,
      identity,
      management,
      owned = false,
      stage = "CREATE_DATABASE";
    let providerCalls = 0,
      loginCalls = 0,
      verifyCalls = 0,
      expiry = false,
      mismatch = false,
      loginMismatch = false,
      mode = "ok",
      pending;
    const tokens = new Map();
    const provider = http.createServer(async (req, res) => {
      providerCalls++;
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (pending && req.url === "/client/api-token-auth/") {
        const gate = pending;
        pending = undefined;
        gate.started();
        await gate.wait;
      }
      if (mode === "500") {
        res.writeHead(500);
        return res.end();
      }
      if (req.url === "/client/api-token-auth/") {
        loginCalls++;
        if (body.password === "wrong") {
          res.writeHead(401);
          return res.end();
        }
        const id = body.username;
        const token = expiry
          ? `synthetic.${Buffer.from(JSON.stringify({ exp: 123 })).toString("base64url")}.${randomUUID()}`
          : "synthetic-" + randomUUID();
        tokens.set(token, id);
        res.end(
          JSON.stringify({
            token,
            user: { userid: loginMismatch ? "999999" : id, is_verified: false },
          }),
        );
      } else {
        verifyCalls++;
        assert.equal(req.url, "/client/api-token-verify/");
        assert.equal(req.headers.authorization, `Bearer ${body.token}`);
        assert.equal(body.FirebaseToken, null);
        res.end(
          JSON.stringify({
            token: body.token,
            user: {
              userid: mismatch ? "999999" : tokens.get(body.token),
              is_verified: "ignored",
            },
          }),
        );
      }
    });
    await new Promise((resolve) => provider.listen(0, "127.0.0.1", resolve));
    const providerUrl = `http://127.0.0.1:${provider.address().port}`;
    const key = randomBytes(32),
      cipher = new SecretCipher({ activeVersion: () => 1, key: () => key });
    function holdLogin() {
      let started, release;
      const ready = new Promise((resolve) => {
          started = resolve;
        }),
        wait = new Promise((resolve) => {
          release = resolve;
        });
      pending = { started, wait };
      return { ready, release };
    }
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
          env: { ...saved, DATABASE_URL: url.toString() },
          stdio: "pipe",
          timeout: 60000,
        },
      );
      db = createDatabase(url.toString());
      store = new CarrierLifecycleAdapter(url.toString());
      identity = new IdentityDatabaseAdapter(url.toString());
      management = new UserManagementAdapter(url.toString());
      const audit = new PostgresSecurityAudit(store.client);
      const makeService = (customCipher = cipher) =>
        new CarrierConnectionLifecycleService(
          store,
          new CarrierCredentialVault(
            store,
            customCipher,
            new UnishipAdapter(new UnishipHttpClient({ apiUrl: providerUrl })),
            audit,
          ),
          new UserCarrierAdmission(),
          audit,
        );
      const service = makeService(),
        hash = await hashPassword("SyntheticLocalPassword!");
      const users = await Promise.all(
        Array.from({ length: 12 }, (_, i) =>
          db.user.create({
            data: {
              username: `lifecycle-${i}`,
              role: i === 0 ? "ADMIN" : "OPERATOR",
              status: "ACTIVE",
              credential: { create: { passwordHash: hash } },
            },
          }),
        ),
      );
      const sessions = await Promise.all(
        users.map((u) =>
          new AuthService(identity)
            .login(u.username, "SyntheticLocalPassword!")
            .then((r) => r.token),
        ),
      );
      Object.assign(process.env, {
        DATABASE_URL: url.toString(),
        STORAGE_ROOT: root,
        UNISHIP_API_URL: providerUrl,
        UNISHIP_LIVE_AUTHORIZED: "false",
        CARRIER_KEYRING_JSON: JSON.stringify({ 1: key.toString("base64") }),
        CARRIER_ACTIVE_KEY_VERSION: "1",
        NODE_ENV: "test",
      });
      app = await NestFactory.create(AppModule, { logger: false });
      configure(app);
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl();
      const allowedOrigin = loadConfig(process.env).trustedOrigins[0];
      const request = async (path, index, body, origin = allowedOrigin) =>
        fetch(base + "/api" + path, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin,
            ...(index === null
              ? {}
              : { cookie: `nexora_session=${sessions[index]}` }),
          },
          body: JSON.stringify(body),
        });
      const input = (id) => ({
        provider: "uniship",
        loginIdentifier: id,
        password: "synthetic-password",
        displayName: "Branch",
      });
      const connect = (user, id, s = makeService()) =>
        s.connect(user.id, input(id));
      let connected;
      stage = "HTTP_CONTRACT";
      await t.test(
        "real HTTP guards, strict payload, verified metadata and encrypted storage",
        async () => {
          assert.equal(
            (await request("/carrier-connections", null, input("101"))).status,
            401,
          );
          assert.equal(
            (
              await request(
                "/carrier-connections",
                1,
                input("101"),
                "https://foreign.invalid",
              )
            ).status,
            403,
          );
          for (const bad of [
            { ...input("101"), userId: users[2].id },
            { ...input("101"), token: "forbidden" },
            { ...input("101"), password: 17 },
            { ...input("101"), displayName: " " },
          ])
            assert.equal(
              (await request("/carrier-connections", 1, bad)).status,
              400,
            );
          const response = await request(
            "/carrier-connections",
            1,
            input("101"),
          );
          assert.equal(response.status, 201);
          assert.equal(response.headers.get("cache-control"), "no-store");
          connected = (await response.json()).connection;
          assert.deepEqual(
            Object.keys(connected).sort(),
            [
              "id",
              "provider",
              "externalAccountId",
              "loginIdentifier",
              "displayName",
              "status",
              "lastVerifiedAt",
              "createdAt",
            ].sort(),
          );
          assert.equal(connected.externalAccountId, "101");
          assert.equal(connected.status, "CONNECTED");
          const beforeForeign = providerCalls;
          for (const index of [0, 2])
            await assert.rejects(
              service.withToken(
                users[index].id,
                connected.id,
                async () => true,
              ),
              { code: "NOT_FOUND" },
            );
          assert.equal(providerCalls, beforeForeign);

          assert.equal(
            (await request("/carrier-connections", 1, input("103"))).status,
            201,
          );
          const list = await fetch(base + "/api/carrier-connections", {
            headers: { cookie: `nexora_session=${sessions[1]}` },
          });
          assert.equal(list.status, 200);
          assert.equal((await list.json()).connections.length, 2);

          const secrets = await db.carrierConnectionSecret.findMany({
            where: { connectionId: connected.id },
          });
          assert.equal(secrets.length, 2);
          for (const secret of secrets) {
            assert.ok(secret.ciphertext);
            assert.equal(
              JSON.stringify(secret).includes("synthetic-password"),
              false,
            );
            assert.equal(
              JSON.stringify(secret).includes("synthetic-token"),
              false,
            );
          }
          assert.equal(
            (
              await request(
                `/carrier-connections/${connected.id}/reconnect`,
                2,
                { password: "synthetic-new" },
              )
            ).status,
            404,
          );
          assert.equal(
            (
              await request(
                `/carrier-connections/${connected.id}/reconnect`,
                0,
                { password: "synthetic-new" },
              )
            ).status,
            404,
          );
          const bad = await request("/carrier-connections", 2, {
              ...input("102"),
              password: "wrong",
            }),
            duplicate = await request("/carrier-connections", 3, input("101"));
          assert.equal(bad.status, 400);
          assert.equal(duplicate.status, 400);
          for (const response of [bad, duplicate]) {
            const error = await response.json();
            assert.equal(error.code, "CANNOT_CONNECT_CARRIER_ACCOUNT");
            assert.equal(error.message, "Không thể kết nối tài khoản này");
          }
          const reasons = (
            await db.securityAuditEvent.findMany({
              where: { outcome: "FAILURE" },
            })
          ).map((e) => e.reason);
          assert.ok(reasons.includes("INVALID_CREDENTIALS"));
          assert.ok(reasons.includes("DUPLICATE_ACCOUNT"));
          assert.equal(loginCalls, verifyCalls + 1); // wrong login is not verified
        },
      );
      stage = "ATOMIC_RECONNECT";
      await t.test(
        "reconnect atomically rotates secrets; mismatch preserves old secrets and requires manual reconnect",
        async () => {
          const before = await db.carrierConnectionSecret.findMany({
            where: { connectionId: connected.id },
            orderBy: { secretType: "asc" },
          });
          const response = await request(
            `/carrier-connections/${connected.id}/reconnect`,
            1,
            { password: "synthetic-new" },
          );
          assert.equal(response.status, 200);
          const after = await db.carrierConnectionSecret.findMany({
            where: { connectionId: connected.id },
            orderBy: { secretType: "asc" },
          });
          assert.notDeepEqual(
            after.map((s) => s.ciphertext),
            before.map((s) => s.ciphertext),
          );
          loginMismatch = true;
          const mismatchResponse = await request(
            `/carrier-connections/${connected.id}/reconnect`,
            1,
            { password: "synthetic-other" },
          );
          assert.equal(mismatchResponse.status, 401);
          loginMismatch = false;
          assert.equal(
            (
              await db.carrierConnection.findUnique({
                where: { id: connected.id },
              })
            ).status,
            "REAUTH_REQUIRED",
          );
          assert.deepEqual(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: connected.id },
              orderBy: { secretType: "asc" },
            }),
            after,
          );
          const calls = providerCalls;
          await assert.rejects(
            service.withToken(users[1].id, connected.id, async () => {}),
            { code: "REAUTH_REQUIRED" },
          );
          assert.equal(providerCalls, calls);
          await makeService().reconnect(
            users[1].id,
            connected.id,
            "synthetic-manual",
          );
          assert.equal(
            (
              await db.carrierConnection.findUnique({
                where: { id: connected.id },
              })
            ).status,
            "CONNECTED",
          );
        },
      );
      stage = "UNIQUENESS_ROLLBACK";
      await t.test(
        "global uniqueness under concurrent creates and secret/audit failure roll back whole transaction",
        async () => {
          const results = await Promise.allSettled([
            connect(users[4], "104"),
            connect(users[5], "104"),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            results.find((r) => r.status === "rejected").reason.code,
            "DUPLICATE",
          );
          await db.$executeRawUnsafe(
            `CREATE FUNCTION reject_lifecycle_secret() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END; $$`,
          );
          await db.$executeRawUnsafe(
            `CREATE TRIGGER reject_lifecycle_secret BEFORE INSERT ON carrier_connection_secrets FOR EACH ROW EXECUTE FUNCTION reject_lifecycle_secret()`,
          );
          await assert.rejects(connect(users[5], "105"));
          assert.equal(
            await db.carrierConnection.count({
              where: { externalAccountId: "105" },
            }),
            0,
          );
          await db.$executeRawUnsafe(
            `DROP TRIGGER reject_lifecycle_secret ON carrier_connection_secrets`,
          );
        },
      );
      stage = "LAZY_AUDIT";
      await t.test(
        "expired token singleflight; audit commits before decrypt; audit failure stops decrypt and provider",
        async () => {
          expiry = true;
          const c = await connect(users[6], "106");
          expiry = false;
          let decrypts = 0;
          const observed = {
            encrypt: (...args) => cipher.encrypt(...args),
            decrypt: (...args) => {
              if (args[0] === "CARRIER_PASSWORD") decrypts++;
              return cipher.decrypt(...args);
            },
          };
          const s = makeService(observed),
            before = loginCalls;
          const hold = holdLogin(),
            operations = Array.from({ length: 12 }, () =>
              s.withToken(users[6].id, c.id, async (token) => {
                assert.ok(token.startsWith("synthetic-"));
                return true;
              }),
            );
          await hold.ready;
          assert.equal(decrypts, 1);
          assert.equal(
            await db.securityAuditEvent.count({
              where: { connectionId: c.id, eventType: "PASSWORD_DECRYPT" },
            }),
            1,
          );
          hold.release();
          assert.deepEqual(await Promise.all(operations), Array(12).fill(true));
          assert.equal(loginCalls, before + 1);
          assert.equal(decrypts, 1);
          const beforeUse = providerCalls;
          await s.withToken(users[6].id, c.id, async () => true);
          assert.equal(providerCalls, beforeUse);
          let rejected = 0;
          await s.withToken(users[6].id, c.id, async () => {
            if (rejected++ === 0)
              throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
            return true;
          });
          assert.equal(rejected, 2);
          await db.carrierConnectionSecret.updateMany({
            where: { connectionId: c.id, secretType: "ACCESS_TOKEN" },
            data: { expiresAt: new Date(0) },
          });
          await db.$executeRawUnsafe(
            `CREATE FUNCTION reject_lifecycle_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit unavailable'; END; $$`,
          );
          await db.$executeRawUnsafe(
            `CREATE TRIGGER reject_lifecycle_audit BEFORE INSERT ON security_audit_events FOR EACH ROW EXECUTE FUNCTION reject_lifecycle_audit()`,
          );
          const calls = providerCalls,
            oldDecrypts = decrypts;
          await assert.rejects(
            makeService(observed).withToken(
              users[6].id,
              c.id,
              async () => true,
            ),
          );
          assert.equal(decrypts, oldDecrypts);
          assert.equal(providerCalls, calls);
          const preserved = await db.carrierConnectionSecret.findMany({
            where: { connectionId: c.id },
            orderBy: { secretType: "asc" },
          });
          await assert.rejects(
            makeService().reconnect(
              users[6].id,
              c.id,
              "synthetic-new-password",
            ),
          );
          assert.deepEqual(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: c.id },
              orderBy: { secretType: "asc" },
            }),
            preserved,
          );
          assert.equal(
            (await db.carrierConnection.findUnique({ where: { id: c.id } }))
              .status,
            "ERROR",
          );
          await assert.rejects(connect(users[6], "116"));
          assert.equal(
            await db.carrierConnection.count({
              where: { externalAccountId: "116" },
            }),
            0,
          );
          await db.$executeRawUnsafe(
            `DROP TRIGGER reject_lifecycle_audit ON security_audit_events`,
          );
        },
      );
      stage = "FENCING";
      await t.test(
        "late reconnect/recovery, deletion, disable and reactivation cannot resurrect secrets",
        async () => {
          const c = await connect(users[7], "107"),
            s = makeService();
          let hold = holdLogin(),
            old = s.reconnect(users[7].id, c.id, "old-password"),
            rejection = assert.rejects(old, { code: "STALE" });
          await hold.ready;
          await makeService().reconnect(users[7].id, c.id, "new-password");
          const savedSecrets = await db.carrierConnectionSecret.findMany({
            where: { connectionId: c.id },
            orderBy: { secretType: "asc" },
          });
          hold.release();
          await rejection;
          assert.deepEqual(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: c.id },
              orderBy: { secretType: "asc" },
            }),
            savedSecrets,
          );
          // Real provider HTTP is pending while disable/re-enable commits: no HTTP-spanning row lock.
          hold = holdLogin();
          old = connect(users[8], "108");
          rejection = assert.rejects(old, { code: "STALE" });
          await hold.ready;
          await management.setStatus(users[0].id, users[8].id, "DISABLED");
          await management.setStatus(users[0].id, users[8].id, "ACTIVE");
          hold.release();
          await rejection;
          assert.equal(
            await db.carrierConnection.count({
              where: { externalAccountId: "108" },
            }),
            0,
          );
          hold = holdLogin();
          old = makeService().reconnect(users[7].id, c.id, "late-password");
          rejection = assert.rejects(old, { code: "NOT_FOUND" });
          await hold.ready;
          await db.carrierConnection.delete({ where: { id: c.id } });
          hold.release();
          await rejection;
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connectionId: c.id },
            }),
            0,
          );
          expiry = true;
          const d = await connect(users[9], "109");
          expiry = false;
          hold = holdLogin();
          old = makeService().withToken(users[9].id, d.id, async () => true);
          rejection = assert.rejects(old, { code: "STALE" });
          await hold.ready;
          await makeService().reconnect(
            users[9].id,
            d.id,
            "new-manual-password",
          );
          const current = await db.carrierConnectionSecret.findMany({
            where: { connectionId: d.id },
            orderBy: { secretType: "asc" },
          });
          hold.release();
          await rejection;
          assert.deepEqual(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: d.id },
              orderBy: { secretType: "asc" },
            }),
            current,
          );
          hold = holdLogin();
          old = makeService().reconnect(users[9].id, d.id, "late-disabled");
          rejection = assert.rejects(old, { code: "UNAUTHORIZED" });
          await hold.ready;
          await management.setStatus(users[0].id, users[9].id, "DISABLED");
          hold.release();
          await rejection;
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connectionId: d.id },
            }),
            0,
          );
          assert.equal(
            (await db.carrierConnection.findUnique({ where: { id: d.id } }))
              .status,
            "REAUTH_REQUIRED",
          );
        },
      );
      stage = "RATE_AND_OUTAGE";
      await t.test(
        "HTTP admission and provider outage/429 preserve local identity and stored secrets",
        async () => {
          for (let i = 0; i < 5; i++)
            assert.equal(
              (
                await request("/carrier-connections", 11, {
                  ...input("111"),
                  password: "wrong",
                })
              ).status,
              400,
            );
          const limited = await request(
            "/carrier-connections",
            11,
            input("111"),
          );
          assert.equal(limited.status, 429);
          assert.equal((await limited.json()).code, "RATE_LIMITED");
          const c = await connect(users[5], "115"),
            before = await db.carrierConnectionSecret.findMany({
              where: { connectionId: c.id },
              orderBy: { secretType: "asc" },
            });
          mode = "500";
          const s = makeService(),
            calls = providerCalls;
          await assert.rejects(s.reconnect(users[5].id, c.id, "synthetic"), {
            code: "SERVICE_UNAVAILABLE",
          });
          await assert.rejects(s.reconnect(users[5].id, c.id, "synthetic"), {
            code: "RATE_LIMITED",
          });
          assert.equal(providerCalls, calls + 1);
          mode = "ok";
          assert.deepEqual(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: c.id },
              orderBy: { secretType: "asc" },
            }),
            before,
          );
          assert.equal(
            (await db.carrierConnection.findUnique({ where: { id: c.id } }))
              .status,
            "ERROR",
          );
          assert.ok(
            await new AuthService(identity).validateSession(sessions[5]),
          );
        },
      );
      stage = "KEY_AND_APPEND_ONLY";
      await t.test(
        "wrong keys preserve ciphertext/status; audit persists across connection/user deletes and rejects ordinary mutation",
        async () => {
          const c = await connect(users[10], "110"),
            before = await db.carrierConnectionSecret.findMany({
              where: { connectionId: c.id },
              orderBy: { secretType: "asc" },
            });
          const badCipher = new SecretCipher({
            activeVersion: () => 1,
            key: () => randomBytes(32),
          });
          await assert.rejects(
            makeService(badCipher).withToken(
              users[10].id,
              c.id,
              async () => true,
            ),
          );
          assert.equal(
            (await db.carrierConnection.findUnique({ where: { id: c.id } }))
              .status,
            "CONNECTED",
          );
          assert.deepEqual(
            await db.carrierConnectionSecret.findMany({
              where: { connectionId: c.id },
              orderBy: { secretType: "asc" },
            }),
            before,
          );
          const events = await db.securityAuditEvent.findMany({
            where: { connectionId: c.id },
          });
          assert.ok(events.length);
          await db.user.delete({ where: { id: users[10].id } });
          assert.deepEqual(
            await db.securityAuditEvent.findMany({
              where: { connectionId: c.id },
            }),
            events,
          );
          for (const sql of [
            `UPDATE security_audit_events SET reason='UNAVAILABLE'`,
            `DELETE FROM security_audit_events`,
            `TRUNCATE security_audit_events`,
          ])
            await assert.rejects(db.$executeRawUnsafe(sql));
          await assert.rejects(
            db.$executeRawUnsafe(
              `INSERT INTO security_audit_events(event_type,outcome,reason,provider,correlation_id) VALUES ('UNKNOWN','SUCCESS','VERIFIED','uniship','${randomUUID()}')`,
            ),
          );
        },
      );
    } catch (error) {
      console.error(`CARRIER_LIFECYCLE_TEST_FAILED step=${stage}`);
      throw error;
    } finally {
      pending = undefined;
      provider.closeAllConnections();
      await new Promise((resolve) => provider.close(resolve));
      await app?.close();
      await store?.onApplicationShutdown();
      await identity?.onApplicationShutdown();
      await management?.onApplicationShutdown();
      await db?.$disconnect();
      if (owned) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
      await admin.$disconnect();
      await rm(root, { recursive: true, force: true });
      for (const key of Object.keys(process.env))
        if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  },
);
