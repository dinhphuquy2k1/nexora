const { loginWithMfa } = require("../test/helpers/mfa-fixture.cjs");
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
      identityOther = false,
      rejectPassword = false,
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
      if (mode === "timeout") return;
      if (mode === "429") {
        res.writeHead(429, { "retry-after": "1" });
        return res.end();
      }
      if (mode === "verify-reject" && req.url === "/client/api-token-verify/") {
        res.writeHead(401);
        return res.end();
      }
      if (mode === "500") {
        res.writeHead(500);
        return res.end();
      }
      if (req.url === "/client/api-token-auth/") {
        loginCalls++;
        if (body.password === "wrong" || rejectPassword) {
          res.writeHead(401);
          return res.end();
        }
        const id =
          identityOther || body.password === "late-other"
            ? "999999"
            : body.username;
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

      store = new CarrierLifecycleAdapter(applicationUrl);
      identity = new IdentityDatabaseAdapter(applicationUrl);
      management = new UserManagementAdapter(applicationUrl);
      const audit = new PostgresSecurityAudit(store.client);
      const makeService = (customCipher = cipher, timeoutMs = 5000) =>
        new CarrierConnectionLifecycleService(
          store,
          new CarrierCredentialVault(
            store,
            customCipher,
            new UnishipAdapter(
              new UnishipHttpClient({ apiUrl: providerUrl, timeoutMs }),
            ),
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
          loginWithMfa(identity, u.username, "SyntheticLocalPassword!").then(
            (r) => r.token,
          ),
        ),
      );
      Object.assign(process.env, {
        DATABASE_URL: applicationUrl,
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
      stage = "SUPERSEDED_LAZY_RECOVERY";
      function deferred() {
        let resolve;
        const promise = new Promise((r) => (resolve = r));
        return { promise, resolve };
      }
      function pauseRecovery(s) {
        const started = deferred(),
          release = deferred();
        const original = s.performRecovery.bind(s);
        let calls = 0;
        s.performRecovery = async (...args) => {
          if (++calls === 1) {
            started.resolve();
            await release.promise;
          }
          return original(...args);
        };
        return {
          started: started.promise,
          release: release.resolve,
          restore: () => {
            s.performRecovery = original;
          },
        };
      }
      const secretRows = (id) =>
        db.carrierConnectionSecret.findMany({
          where: { connectionId: id },
          orderBy: { secretType: "asc" },
        });
      for (const callers of [1, 20])
        await t.test(
          `PG expired token plus failed manual claim: ${callers} callers recover exactly once`,
          async () => {
            expiry = true;
            let c;
            try {
              c = await connect(users[2], String(310 + callers));
            } finally {
              expiry = false;
            }
            const s = app.get(CarrierConnectionLifecycleService),
              gate = pauseRecovery(s),
              before = await secretRows(c.id),
              initial = await store.read(users[2].id, c.id),
              logins = loginCalls;
            let operations = 0;
            const pending = Array.from({ length: callers }, () =>
              s.withToken(users[2].id, c.id, async (token) => {
                operations++;
                assert.ok(token.startsWith("synthetic-"));
                assert.ok(tokens.has(token));
                assert.equal(tokens.get(token), String(310 + callers));
                return true;
              }),
            );
            await gate.started;
            try {
              await assert.rejects(s.reconnect(users[2].id, c.id, "wrong"), {
                code: "PROVIDER_AUTH_FAILED",
              });
              const afterManual = await store.read(users[2].id, c.id);
              assert.ok(afterManual.version > initial.version);
              assert.ok(afterManual.tokenRevision === initial.tokenRevision);
              assert.equal(afterManual.connection.status, "CONNECTED");
              assert.deepEqual(
                afterManual.connection.lastVerifiedAt,
                initial.connection.lastVerifiedAt,
              );
              assert.deepEqual(await secretRows(c.id), before);
              if (callers === 1) {
                // Fixture-only metadata perturbation: null cannot prove refresh of
                // a sealed token this operation already observed as expired.
                await db.carrierConnectionSecret.updateMany({
                  where: { connectionId: c.id, secretType: "ACCESS_TOKEN" },
                  data: { expiresAt: null },
                });
                const metadataOnly = await store.read(users[2].id, c.id);
                assert.equal(metadataOnly.expiresAt, null);
                assert.equal(metadataOnly.tokenRevision, initial.tokenRevision);
              }
            } finally {
              gate.release();
            }
            try {
              assert.deepEqual(
                await Promise.all(pending),
                Array(callers).fill(true),
              );
            } finally {
              gate.restore();
            }
            const current = await store.read(users[2].id, c.id);
            assert.equal(current.connection.status, "CONNECTED");
            assert.ok(current.tokenRevision !== initial.tokenRevision);
            assert.equal(current.expiresAt, null);
            assert.equal(operations, callers);
            assert.equal(loginCalls, logins + 2);
            assert.equal(s.recoveries.size, 0);
            assert.equal(
              await db.securityAuditEvent.count({
                where: { connectionId: c.id, eventType: "PASSWORD_DECRYPT" },
              }),
              1,
            );
            assert.equal(
              await db.securityAuditEvent.count({
                where: {
                  connectionId: c.id,
                  eventType: "RECOVERY",
                  outcome: "SUCCESS",
                },
              }),
              1,
            );
          },
        );
      await t.test(
        "PG unknown-expiry rejected token survives only as old ciphertext until bounded recovery",
        async () => {
          const c = await connect(users[4], "341"),
            s = makeService(),
            before = await secretRows(c.id),
            initial = await store.read(users[4].id, c.id),
            logins = loginCalls;
          let operations = 0,
            oldToken;
          assert.equal(initial.expiresAt, null);
          assert.equal(
            await s.withToken(users[4].id, c.id, async (token) => {
              operations++;
              if (operations === 1) {
                oldToken = token;
                await assert.rejects(s.reconnect(users[4].id, c.id, "wrong"), {
                  code: "PROVIDER_AUTH_FAILED",
                });
                const claimed = await store.read(users[4].id, c.id);
                assert.ok(claimed.version > initial.version);
                assert.ok(claimed.tokenRevision === initial.tokenRevision);
                assert.deepEqual(await secretRows(c.id), before);
                throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
              }
              assert.ok(token !== oldToken);
              assert.equal(tokens.get(token), "341");
              return true;
            }),
            true,
          );
          assert.equal(operations, 2);
          assert.equal(loginCalls, logins + 2);
          assert.equal(s.recoveries.size, 0);
          assert.equal(
            await db.securityAuditEvent.count({
              where: { connectionId: c.id, eventType: "PASSWORD_DECRYPT" },
            }),
            1,
          );
        },
      );
      for (const expired of [true, false])
        await t.test(
          `PG concurrent successful manual token reused without password decrypt (expired=${expired})`,
          async () => {
            expiry = expired;
            let c;
            try {
              c = await connect(users[4], expired ? "342" : "343");
            } finally {
              expiry = false;
            }
            const s = makeService(),
              initial = await store.read(users[4].id, c.id),
              logins = loginCalls;
            let operations = 0;
            if (expired) {
              const gate = pauseRecovery(s);
              const pending = s.withToken(users[4].id, c.id, async () => {
                operations++;
                return true;
              });
              await gate.started;
              await s.reconnect(users[4].id, c.id, "new-manual");
              gate.release();
              try {
                assert.equal(await pending, true);
              } finally {
                gate.restore();
              }
            } else
              assert.equal(
                await s.withToken(users[4].id, c.id, async () => {
                  operations++;
                  if (operations === 1) {
                    await s.reconnect(users[4].id, c.id, "new-manual");
                    throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
                  }
                  return true;
                }),
                true,
              );
            const current = await store.read(users[4].id, c.id);
            assert.ok(current.tokenRevision !== initial.tokenRevision);
            assert.equal(current.connection.status, "CONNECTED");
            assert.equal(loginCalls, logins + 1);
            assert.equal(
              await db.securityAuditEvent.count({
                where: { connectionId: c.id, eventType: "PASSWORD_DECRYPT" },
              }),
              0,
            );
            assert.equal(s.recoveries.size, 0);
            assert.equal(operations, expired ? 1 : 2);
          },
        );
      await t.test(
        "PG repeated failed claims stop after three rechecks without stale writes or decrypt",
        async () => {
          expiry = true;
          let c;
          try {
            c = await connect(users[4], "344");
          } finally {
            expiry = false;
          }
          const s = makeService(),
            original = s.performRecovery.bind(s),
            before = await secretRows(c.id);
          let decisions = 0,
            operations = 0;
          s.performRecovery = async (...args) => {
            if (++decisions > 5) throw Error("UNBOUNDED_RECOVERY");
            await assert.rejects(s.reconnect(users[4].id, c.id, "wrong"), {
              code: "PROVIDER_AUTH_FAILED",
            });
            return original(...args);
          };
          await assert.rejects(
            s.withToken(users[4].id, c.id, async () => operations++),
            { code: "STALE" },
          );
          assert.ok(decisions <= 3);
          assert.equal(operations, 0);
          assert.deepEqual(await secretRows(c.id), before);
          assert.equal(
            (await store.read(users[4].id, c.id)).connection.status,
            "CONNECTED",
          );
          assert.equal(
            await db.securityAuditEvent.count({
              where: { connectionId: c.id, eventType: "PASSWORD_DECRYPT" },
            }),
            0,
          );
          assert.equal(s.recoveries.size, 0);
        },
      );
      for (const revocation of ["disable", "delete"])
        await t.test(
          `PG recovery waiting before authorization fails closed on ${revocation}`,
          async () => {
            expiry = true;
            let c;
            try {
              c = await connect(
                users[4],
                revocation === "disable" ? "345" : "346",
              );
            } finally {
              expiry = false;
            }
            const s = makeService(),
              gate = pauseRecovery(s),
              logins = loginCalls;
            let operations = 0;
            await assert.rejects(
              s.withToken(users[3].id, c.id, async () => {}),
              { code: "NOT_FOUND" },
            );
            const result = assert.rejects(
              s.withToken(users[4].id, c.id, async () => operations++),
              { code: revocation === "disable" ? "UNAUTHORIZED" : "NOT_FOUND" },
            );
            await gate.started;
            if (revocation === "disable")
              await management.setStatus(users[0].id, users[4].id, "DISABLED");
            else await db.carrierConnection.delete({ where: { id: c.id } });
            gate.release();
            try {
              await result;
            } finally {
              gate.restore();
            }
            assert.equal(operations, 0);
            assert.equal(loginCalls, logins);
            assert.equal(
              await db.carrierConnectionSecret.count({
                where: { connectionId: c.id },
              }),
              0,
            );
            assert.equal(
              await db.securityAuditEvent.count({
                where: { connectionId: c.id, eventType: "PASSWORD_DECRYPT" },
              }),
              0,
            );
            assert.equal(s.recoveries.size, 0);
            if (revocation === "disable") {
              await management.setStatus(users[0].id, users[4].id, "ACTIVE");
              sessions[4] = (
                await new AuthService(identity).login(
                  users[4].username,
                  "SyntheticLocalPassword!",
                )
              ).token;
            }
          },
        );
      stage = "NON_DESTRUCTIVE_MANUAL";
      await t.test(
        "failed manual replacement preserves full rows, verification time, usable old token and failure audit",
        async () => {
          const c = await connect(users[4], "119");
          const rows = () =>
            db.carrierConnectionSecret.findMany({
              where: { connectionId: c.id },
              orderBy: { secretType: "asc" },
            });
          const row = () =>
            db.carrierConnection.findUniqueOrThrow({ where: { id: c.id } });
          const protectedFields = (r) => ({
            status: r.status,
            lastVerifiedAt: r.lastVerifiedAt,
            externalAccountId: r.externalAccountId,
            userId: r.userId,
            loginIdentifier: r.loginIdentifier,
          });
          const before = await rows(),
            initial = await row();
          const oldToken = await makeService().withToken(
            users[4].id,
            c.id,
            async (token) => token,
          );
          const wrong = await request(
            `/carrier-connections/${c.id}/reconnect`,
            4,
            { password: "wrong" },
          );
          assert.equal(wrong.status, 401);
          assert.equal((await wrong.json()).code, "PROVIDER_AUTH_FAILED");
          assert.deepEqual(await rows(), before);
          assert.deepEqual(
            protectedFields(await row()),
            protectedFields(initial),
          );
          assert.equal(
            await makeService().withToken(
              users[4].id,
              c.id,
              async (token) => token,
            ),
            oldToken,
          );
          const outage = await (async () => {
            mode = "timeout";
            try {
              return await request(
                `/carrier-connections/${c.id}/reconnect`,
                4,
                { password: "synthetic" },
              );
            } finally {
              mode = "ok";
            }
          })();
          assert.equal(outage.status, 503);
          assert.equal((await outage.json()).code, "SERVICE_UNAVAILABLE");
          assert.deepEqual(await rows(), before);
          assert.deepEqual(
            protectedFields(await row()),
            protectedFields(initial),
          );
          // Respect the actual process-wide transport backoff before later HTTP tests.
          await new Promise((resolve) => setTimeout(resolve, 1050));
          let passwordDecrypts = 0;
          const observed = {
            encrypt: (...args) => cipher.encrypt(...args),
            decrypt: (...args) => {
              if (args[0] === "CARRIER_PASSWORD") passwordDecrypts++;
              return cipher.decrypt(...args);
            },
          };
          for (const [state, kind, error, reason] of [
            [
              "CONNECTED",
              "wrong",
              "PROVIDER_AUTH_FAILED",
              "INVALID_CREDENTIALS",
            ],
            ["CONNECTED", "500", "SERVICE_UNAVAILABLE", "UNAVAILABLE"],
            ["CONNECTED", "timeout", "SERVICE_UNAVAILABLE", "UNAVAILABLE"],
            ["CONNECTED", "429", "RATE_LIMITED", "UNAVAILABLE"],
            [
              "CONNECTED",
              "verify-reject",
              "TOKEN_REJECTED",
              "INVALID_CREDENTIALS",
            ],
            [
              "CONNECTED",
              "inconsistent",
              "CANDIDATE_IDENTITY_MISMATCH",
              "IDENTITY_MISMATCH",
            ],
            [
              "REAUTH_REQUIRED",
              "wrong",
              "PROVIDER_AUTH_FAILED",
              "INVALID_CREDENTIALS",
            ],
            ["ERROR", "wrong", "PROVIDER_AUTH_FAILED", "INVALID_CREDENTIALS"],
          ]) {
            // Privileged fixture only; all business calls use actual nexora_app.
            await db.carrierConnection.update({
              where: { id: c.id },
              data: { status: state },
            });
            const baseline = await row(),
              correlationId = randomUUID();
            mode = ["wrong", "inconsistent"].includes(kind) ? "ok" : kind;
            loginMismatch = kind === "inconsistent";
            try {
              await assert.rejects(
                makeService(
                  observed,
                  kind === "timeout" ? 100 : 5000,
                ).reconnect(
                  users[4].id,
                  c.id,
                  kind === "wrong" ? "wrong" : "synthetic",
                  correlationId,
                ),
                { code: error },
              );
            } finally {
              mode = "ok";
              loginMismatch = false;
            }
            assert.deepEqual(await rows(), before);
            assert.deepEqual(
              protectedFields(await row()),
              protectedFields(baseline),
            );
            const events = await db.securityAuditEvent.findMany({
              where: { correlationId },
            });
            assert.equal(events.length, 1);
            assert.equal(events[0].eventType, "RECONNECT");
            assert.equal(events[0].outcome, "FAILURE");
            assert.equal(events[0].reason, reason);
            if (state === "CONNECTED")
              assert.equal(
                await makeService(observed).withToken(
                  users[4].id,
                  c.id,
                  async (token) => token,
                ),
                oldToken,
              );
          }
          await db.carrierConnection.update({
            where: { id: c.id },
            data: { status: "CONNECTED" },
          });
          loginMismatch = true;
          try {
            const inconsistent = await request(
              `/carrier-connections/${c.id}/reconnect`,
              4,
              { password: "synthetic" },
            );
            assert.equal(inconsistent.status, 401);
            assert.equal(
              (await inconsistent.json()).code,
              "PROVIDER_AUTH_FAILED",
            );
            const generic = await request(
              "/carrier-connections",
              4,
              input("129"),
            );
            assert.equal(generic.status, 400);
            assert.equal(
              (await generic.json()).code,
              "CANNOT_CONNECT_CARRIER_ACCOUNT",
            );
          } finally {
            loginMismatch = false;
          }
          assert.deepEqual(await rows(), before);
          assert.deepEqual(
            protectedFields(await row()),
            protectedFields(initial),
          );
          assert.equal(passwordDecrypts, 0);
          assert.equal(
            await db.securityAuditEvent.count({
              where: { connectionId: c.id, eventType: "PASSWORD_DECRYPT" },
            }),
            0,
          );
        },
      );
      stage = "RECOVERY_FAILURE_POLICIES";
      await t.test(
        "automatic recovery retains password/identity reauth and temporary-failure ERROR policies",
        async () => {
          let index = 0;
          for (const [kind, code, status] of [
            ["wrong", "PROVIDER_AUTH_FAILED", "REAUTH_REQUIRED"],
            ["inconsistent", "CANDIDATE_IDENTITY_MISMATCH", "REAUTH_REQUIRED"],
            ["other", "IDENTITY_MISMATCH", "REAUTH_REQUIRED"],
            ["verify-reject", "TOKEN_REJECTED", "REAUTH_REQUIRED"],
            ["500", "SERVICE_UNAVAILABLE", "ERROR"],
            ["timeout", "SERVICE_UNAVAILABLE", "ERROR"],
            ["429", "RATE_LIMITED", "ERROR"],
          ]) {
            expiry = true;
            let c;
            try {
              c = await connect(users[4], String(200 + index++));
            } finally {
              expiry = false;
            }
            const rows = () =>
              db.carrierConnectionSecret.findMany({
                where: { connectionId: c.id },
                orderBy: { secretType: "asc" },
              });
            const before = await rows(),
              baseline = await db.carrierConnection.findUniqueOrThrow({
                where: { id: c.id },
              }),
              correlationId = randomUUID();
            mode = ["wrong", "inconsistent", "other"].includes(kind)
              ? "ok"
              : kind;
            rejectPassword = kind === "wrong";
            loginMismatch = kind === "inconsistent";
            identityOther = kind === "other";
            let operations = 0;
            try {
              await assert.rejects(
                makeService(cipher, kind === "timeout" ? 100 : 5000).withToken(
                  users[4].id,
                  c.id,
                  async () => {
                    operations++;
                  },
                  correlationId,
                ),
                { code },
              );
            } finally {
              mode = "ok";
              rejectPassword = false;
              loginMismatch = false;
              identityOther = false;
            }
            assert.equal(operations, 0);
            assert.deepEqual(await rows(), before);
            const after = await db.carrierConnection.findUniqueOrThrow({
              where: { id: c.id },
            });
            assert.equal(after.status, status);
            assert.deepEqual(after.lastVerifiedAt, baseline.lastVerifiedAt);
            assert.equal(after.externalAccountId, baseline.externalAccountId);
            const events = await db.securityAuditEvent.findMany({
              where: { correlationId },
            });
            assert.equal(
              events.filter((e) => e.eventType === "PASSWORD_DECRYPT").length,
              1,
            );
            assert.equal(
              events.filter(
                (e) => e.eventType === "RECOVERY" && e.outcome === "FAILURE",
              ).length,
              1,
            );
          }
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
          identityOther = true;
          const mismatchResponse = await request(
            `/carrier-connections/${connected.id}/reconnect`,
            1,
            { password: "synthetic-other" },
          );
          assert.equal(mismatchResponse.status, 401);
          identityOther = false;
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
            old = s.reconnect(users[7].id, c.id, "late-other"),
            rejection = assert.rejects(old, { code: "IDENTITY_MISMATCH" });
          await hold.ready;
          await makeService().reconnect(users[7].id, c.id, "new-password");
          const savedSecrets = await db.carrierConnectionSecret.findMany({
            where: { connectionId: c.id },
            orderBy: { secretType: "asc" },
          });
          const winning = await db.carrierConnection.findUniqueOrThrow({
            where: { id: c.id },
          });
          hold.release();
          await rejection;
          assert.deepEqual(
            await db.carrierConnection.findUniqueOrThrow({
              where: { id: c.id },
            }),
            winning,
          );
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
          rejection = old.then((value) => assert.equal(value, true));
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
            "CONNECTED",
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
