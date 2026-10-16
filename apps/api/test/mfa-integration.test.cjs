require("reflect-metadata");
const { setImmediate } = require("node:timers");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { resolve, join } = require("node:path");
const { mkdtemp, rm, readFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { createDatabase, hashPassword } = require("@nexora/database");
const { NestFactory } = require("@nestjs/core");
const { Controller, Get, Module } = require("@nestjs/common");
const { Public } = require("../dist/identity/presentation/public.decorator");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const { loadConfig } = require("../dist/config");
const {
  IdentityDatabaseAdapter,
} = require("../dist/identity/infrastructure/identity.adapter");
const {
  IdentityMfaAdapter,
} = require("../dist/identity/infrastructure/mfa.adapter");
const {
  UserManagementAdapter,
} = require("../dist/identity/infrastructure/user-management.adapter");
const { AuthService } = require("../dist/identity/application/auth.service");
const { MfaService } = require("../dist/identity/application/mfa.service");
const { SecretCipher } = require("../dist/common/crypto/secret-cipher");
const {
  EnvironmentKeyring,
} = require("../dist/common/crypto/environment-keyring");
const {
  generateTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
  totpAt,
} = require("../dist/identity/infrastructure/totp");
const hash = (s) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("hex");
function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
test(
  "ADMIN MFA genuine PostgreSQL/runtime-role/Nest replay, fencing and rollback",
  { timeout: 180000 },
  async (t) => {
    const saved = { ...process.env },
      name = "nexora_mfa_" + randomUUID().replaceAll("-", ""),
      admin = createDatabase(saved.DATABASE_URL),
      url = new URL(saved.DATABASE_URL),
      root = await mkdtemp(join(tmpdir(), "nexora-mfa-"));
    url.pathname = "/" + name;
    let owned = false,
      db,
      identity,
      mfa,
      management,
      app;
    let stage = "CREATE";
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
      const applicationUrl = runtimeUrl(url.toString(), runtimePassword),
        key = randomBytes(32).toString("base64");
      Object.assign(process.env, {
        DATABASE_URL: applicationUrl,
        STORAGE_ROOT: root,
        IDENTITY_KEYRING_JSON: JSON.stringify({ 1: key }),
        IDENTITY_ACTIVE_KEY_VERSION: "1",
        NODE_ENV: "test",
      });
      const cipher = new SecretCipher(
        new EnvironmentKeyring(process.env, "IDENTITY"),
      );
      identity = new IdentityDatabaseAdapter(applicationUrl);
      mfa = new IdentityMfaAdapter(applicationUrl, cipher);
      management = new UserManagementAdapter(applicationUrl);
      const password = "MfaIntegrationFixture!",
        passwordHash = await hashPassword(password),
        fixture = async (role = "ADMIN") =>
          db.user.create({
            data: {
              username: "mfa-" + randomUUID(),
              role,
              status: "ACTIVE",
              credential: { create: { passwordHash } },
            },
          });
      const a = await fixture(),
        b = await fixture(),
        op = await fixture("OPERATOR"),
        unenrolled = await fixture();
      const enroll = async (user) => {
        const secret = generateTotpSecret(),
          codes = generateRecoveryCodes();
        await mfa.enroll(
          user.id,
          passwordHash,
          secret,
          Math.floor(Date.now() / 30000),
          codes.map(hashRecoveryCode),
        );
        return { user, secret, codes };
      };
      const af = await enroll(a),
        bf = await enroll(b);
      const challenge = async (user = a) => {
        const auth = new AuthService(identity, Date.now, mfa);
        const result = await auth.login(user.username, password);
        assert.equal(result.mfaRequired, true);
        assert.equal(result.token, undefined);
        return result.challengeToken;
      };
      const verify = async (raw, input) =>
        new MfaService(mfa, new AuthService(identity)).verify(raw, input);
      const recovery = (f) => ({ type: "recovery", code: f.codes.shift() });
      stage = "REPLAY_RACES";
      await t.test(
        "one challenge,20 concurrent valid verifications create exactly one MFA session",
        async () => {
          const c = await challenge(),
            input = recovery(af),
            before = await db.session.count({ where: { userId: a.id } });
          const settled = await Promise.allSettled(
            Array.from({ length: 20 }, () => verify(c, input)),
          );
          assert.equal(
            settled.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(
            await db.session.count({ where: { userId: a.id } }),
            before + 1,
          );
          assert.equal(
            await db.mfaRecoveryCode.count({
              where: { userId: a.id, usedAt: { not: null } },
            }),
            1,
          );
          assert.ok(
            (
              await db.mfaChallenge.findUnique({
                where: { tokenHash: hash(c) },
              })
            ).consumedAt,
          );
          await assert.rejects(verify(c, input));
        },
      );
      await t.test(
        "different challenges cannot consume same recovery code twice or another user code",
        async () => {
          const one = await challenge(),
            two = await challenge(),
            input = recovery(af);
          const settled = await Promise.allSettled([
            verify(one, input),
            verify(two, input),
          ]);
          assert.equal(
            settled.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const foreign = await challenge(b);
          await assert.rejects(verify(foreign, recovery(af)));
          assert.equal(
            (
              await db.mfaChallenge.findUnique({
                where: { tokenHash: hash(foreign) },
              })
            ).consumedAt,
            null,
          );
        },
      );
      await t.test(
        "TOTP same-step replay across distinct challenges is atomic",
        async () => {
          const c1 = await challenge(),
            c2 = await challenge(),
            code = totpAt(af.secret, Math.floor(Date.now() / 30000) + 1),
            input = { type: "totp", code };
          const settled = await Promise.allSettled([
            verify(c1, input),
            verify(c2, input),
          ]);
          assert.equal(
            settled.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const current = await db.userMfa.findUnique({
            where: { userId: a.id },
          });
          assert.ok(
            current.lastUsedStep >= BigInt(Math.floor(Date.now() / 30000) - 1),
          );
          await assert.rejects(verify(await challenge(), input));
        },
      );
      await t.test(
        "CLI enrollment step is already consumed; duplicate enrollment never overwrites",
        async () => {
          const u = await fixture(),
            secret = generateTotpSecret(),
            step = Math.floor(Date.now() / 30000),
            codes = generateRecoveryCodes();
          await mfa.enroll(
            u.id,
            passwordHash,
            secret,
            step,
            codes.map(hashRecoveryCode),
          );
          const before = await db.userMfa.findUnique({
            where: { userId: u.id },
          });
          await assert.rejects(
            verify(await challenge(u), {
              type: "totp",
              code: totpAt(secret, step),
            }),
          );
          await assert.rejects(
            mfa.enroll(
              u.id,
              passwordHash,
              generateTotpSecret(),
              step,
              codes.map(hashRecoveryCode),
            ),
          );
          assert.deepEqual(
            await db.userMfa.findUnique({ where: { userId: u.id } }),
            before,
          );
          assert.equal(
            await db.mfaRecoveryCode.count({ where: { userId: u.id } }),
            10,
          );
          secret.fill(0);
        },
      );
      await t.test(
        "session insertion failure rolls back challenge and recovery consumption",
        async () => {
          const c = await challenge(),
            input = recovery(af),
            before = await db.session.count();
          await db.$executeRawUnsafe(
            "CREATE FUNCTION reject_mfa_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture failure'; END $$",
          );
          await db.$executeRawUnsafe(
            "CREATE TRIGGER reject_mfa_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_mfa_session()",
          );
          try {
            await assert.rejects(verify(c, input));
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER reject_mfa_session ON sessions",
            );
            await db.$executeRawUnsafe("DROP FUNCTION reject_mfa_session()");
          }
          assert.equal(await db.session.count(), before);
          assert.equal(
            (
              await db.mfaChallenge.findUnique({
                where: { tokenHash: hash(c) },
              })
            ).consumedAt,
            null,
          );
          assert.equal(
            (
              await db.mfaRecoveryCode.findUnique({
                where: {
                  userId_codeHash: {
                    userId: a.id,
                    codeHash: hashRecoveryCode(input.code),
                  },
                },
              })
            ).usedAt,
            null,
          );
          await verify(c, input);
        },
      );
      await t.test(
        "challenge expiry and unknown/malformed/cross-user tokens fail without consuming proof",
        async () => {
          const c = await challenge(),
            input = recovery(af);
          await db.mfaChallenge.update({
            where: { tokenHash: hash(c) },
            data: { expiresAt: new Date(0) },
          });
          for (const raw of [c, token(), "%", "A".repeat(64)])
            await assert.rejects(verify(raw, input));
          assert.equal(
            (
              await db.mfaRecoveryCode.findUnique({
                where: {
                  userId_codeHash: {
                    userId: a.id,
                    codeHash: hashRecoveryCode(input.code),
                  },
                },
              })
            ).usedAt,
            null,
          );
        },
      );
      await t.test(
        "challenge survives independent adapter restart and recovery needs no decrypt fallback",
        async () => {
          const c = await challenge(),
            replacement = new IdentityMfaAdapter(
              applicationUrl,
              new SecretCipher(new EnvironmentKeyring(process.env, "IDENTITY")),
            );
          try {
            const result = await new MfaService(
              replacement,
              new AuthService(identity),
            ).verify(c, recovery(af));
            assert.ok(
              await new AuthService(identity).validateSession(result.token),
            );
          } finally {
            await replacement.onApplicationShutdown();
          }
        },
      );
      await t.test(
        "lost key fails TOTP closed without consuming challenge or altering ciphertext",
        async () => {
          const c = await challenge(b),
            before = await db.userMfa.findUnique({ where: { userId: b.id } }),
            bad = new IdentityMfaAdapter(
              applicationUrl,
              new SecretCipher(new EnvironmentKeyring({}, "IDENTITY")),
            );
          try {
            await assert.rejects(
              new MfaService(bad, new AuthService(identity)).verify(c, {
                type: "totp",
                code: totpAt(bf.secret, Math.floor(Date.now() / 30000)),
              }),
            );
          } finally {
            await bad.onApplicationShutdown();
          }
          assert.deepEqual(
            await db.userMfa.findUnique({ where: { userId: b.id } }),
            before,
          );
          assert.equal(
            (
              await db.mfaChallenge.findUnique({
                where: { tokenHash: hash(c) },
              })
            ).consumedAt,
            null,
          );
          assert.ok(
            (await new AuthService(identity).login(op.username, password))
              .token,
          );
        },
      );
      stage = "USER_LOCK_RACES";
      for (const mutation of ["status", "role", "password"])
        await t.test(
          `password verification then ${mutation} change aborts challenge issuance`,
          async () => {
            const u = await fixture(),
              uf = await enroll(u),
              adapter = new IdentityDatabaseAdapter(applicationUrl),
              started = deferred(),
              release = deferred(),
              original = adapter.verifyPassword.bind(adapter);
            adapter.verifyPassword = async (...args) => {
              const result = await original(...args);
              started.resolve();
              await release.promise;
              return result;
            };
            const pending = new AuthService(adapter, Date.now, mfa).login(
              u.username,
              password,
            );
            const rejected = assert.rejects(
              pending,
              (e) => e.getStatus() === 401,
            );
            await started.promise;
            if (mutation === "password")
              await db.userCredential.update({
                where: { userId: u.id },
                data: {
                  passwordHash: await hashPassword("ChangedFixturePassword!"),
                },
              });
            else
              await db.user.update({
                where: { id: u.id },
                data:
                  mutation === "role"
                    ? { role: "OPERATOR" }
                    : { status: "DISABLED" },
              });
            release.resolve();
            await rejected;
            assert.equal(
              await db.mfaChallenge.count({ where: { userId: u.id } }),
              0,
            );
            assert.equal(
              await db.session.count({ where: { userId: u.id } }),
              0,
            );
            uf.secret.fill(0);
            await adapter.onApplicationShutdown();
          },
        );
      await t.test(
        "disable while MFA waits on user lock revokes sessions/challenges and Carrier secrets atomically",
        async () => {
          const u = await fixture(),
            f = await enroll(u),
            c = await challenge(u),
            initial = await verify(await challenge(u), recovery(f));
          const conn = await db.carrierConnection.create({
            data: {
              userId: u.id,
              provider: "uniship",
              externalAccountId: randomUUID(),
              displayName: "MFA preservation fixture",
              status: "CONNECTED",
              secrets: {
                create: {
                  secretType: "PASSWORD",
                  ciphertext: "opaque-fixture",
                  nonce: "opaque-fixture",
                  authTag: "opaque-fixture",
                  keyVersion: 1,
                },
              },
            },
          });
          const locked = deferred(),
            release = deferred();
          const blocking = db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM users WHERE id=${u.id}::uuid FOR UPDATE`;
            locked.resolve();
            await release.promise;
            await tx.user.update({
              where: { id: u.id },
              data: { status: "DISABLED" },
            });
            await tx.session.deleteMany({ where: { userId: u.id } });
            await tx.mfaChallenge.deleteMany({ where: { userId: u.id } });
          });
          await locked.promise;
          const pending = verify(c, recovery(f)),
            rejected = assert.rejects(pending);
          let waited = false;
          try {
            const deadline = Date.now() + 2000;
            while (Date.now() < deadline) {
              const rows =
                await db.$queryRaw`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='nexora_app' AND wait_event_type='Lock' AND query LIKE '%FROM users%') AS waiting`;
              if (rows[0].waiting) {
                waited = true;
                break;
              }
              await new Promise((resolve) => setImmediate(resolve));
            }
            assert.ok(
              waited,
              "MFA verifier must actually wait on the locked user",
            );
          } finally {
            release.resolve();
          }
          await blocking;
          await rejected;
          assert.equal(
            await new AuthService(identity).validateSession(initial.token),
            null,
          );
          await management.setStatus(a.id, u.id, "DISABLED");
          assert.equal(
            await db.mfaChallenge.count({ where: { userId: u.id } }),
            0,
          );
          assert.equal(
            await db.carrierConnectionSecret.count({
              where: { connectionId: conn.id },
            }),
            0,
          );
          await management.setStatus(a.id, u.id, "ACTIVE");
          await assert.rejects(verify(c, recovery(f)));
          assert.equal(
            await new AuthService(identity).validateSession(initial.token),
            null,
          );
          f.secret.fill(0);
        },
      );
      await t.test(
        "enrollment password/status race aborts and never inserts recovery material",
        async () => {
          const u = await fixture(),
            verified = await mfa.enrollmentIdentity(u.username, password),
            secret = generateTotpSecret();
          await db.userCredential.update({
            where: { userId: u.id },
            data: { passwordHash: await hashPassword("NewEnrollmentFixture!") },
          });
          await assert.rejects(
            mfa.enroll(
              u.id,
              verified.passwordHash,
              secret,
              Math.floor(Date.now() / 30000),
              generateRecoveryCodes().map(hashRecoveryCode),
            ),
          );
          assert.equal(await db.userMfa.count({ where: { userId: u.id } }), 0);
          assert.equal(
            await db.mfaRecoveryCode.count({ where: { userId: u.id } }),
            0,
          );
          secret.fill(0);
        },
      );
      await t.test(
        "concurrent CLI enrollment has one winner and revokes preexisting challenges/sessions",
        async () => {
          const u = await fixture(),
            secret1 = generateTotpSecret(),
            secret2 = generateTotpSecret(),
            codes1 = generateRecoveryCodes(),
            codes2 = generateRecoveryCodes(),
            step = Math.floor(Date.now() / 30000);
          const old = token();
          await db.session.create({
            data: {
              userId: u.id,
              tokenHash: hash(old),
              expiresAt: new Date(Date.now() + 60000),
            },
          });
          const pending = token();
          await db.mfaChallenge.create({
            data: {
              userId: u.id,
              tokenHash: hash(pending),
              expiresAt: new Date(Date.now() + 60000),
            },
          });
          const results = await Promise.allSettled([
            mfa.enroll(
              u.id,
              passwordHash,
              secret1,
              step,
              codes1.map(hashRecoveryCode),
            ),
            mfa.enroll(
              u.id,
              passwordHash,
              secret2,
              step,
              codes2.map(hashRecoveryCode),
            ),
            verify(pending, { type: "totp", code: totpAt(secret1, step) }),
          ]);
          assert.equal(
            results.slice(0, 2).filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(results[2].status, "rejected");
          assert.equal(
            await db.mfaRecoveryCode.count({ where: { userId: u.id } }),
            10,
          );
          assert.equal(await db.session.count({ where: { userId: u.id } }), 0);
          assert.equal(
            await db.mfaChallenge.count({ where: { userId: u.id } }),
            0,
          );
          assert.equal(
            await new AuthService(identity).validateSession(old),
            null,
          );
          secret1.fill(0);
          secret2.fill(0);
        },
      );
      await t.test(
        "session insertion failure also rolls back monotonic TOTP step",
        async () => {
          const u = await fixture(),
            f = await enroll(u),
            c = await challenge(u),
            before = await db.userMfa.findUnique({ where: { userId: u.id } }),
            input = {
              type: "totp",
              code: totpAt(f.secret, Math.floor(Date.now() / 30000) + 1),
            };
          await db.$executeRawUnsafe(
            "CREATE FUNCTION reject_mfa_step_session() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled rollback'; END $$",
          );
          await db.$executeRawUnsafe(
            "CREATE TRIGGER reject_mfa_step_session BEFORE INSERT ON sessions FOR EACH ROW EXECUTE FUNCTION reject_mfa_step_session()",
          );
          try {
            await assert.rejects(verify(c, input));
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER reject_mfa_step_session ON sessions",
            );
            await db.$executeRawUnsafe(
              "DROP FUNCTION reject_mfa_step_session()",
            );
          }
          assert.deepEqual(
            await db.userMfa.findUnique({ where: { userId: u.id } }),
            before,
          );
          assert.equal(
            (
              await db.mfaChallenge.findUnique({
                where: { tokenHash: hash(c) },
              })
            ).consumedAt,
            null,
          );
          await verify(c, input);
          f.secret.fill(0);
        },
      );
      await t.test(
        "cancel is targeted, idempotent and never consumes proof material",
        async () => {
          const u = await fixture(),
            f = await enroll(u),
            other = await challenge(b);
          const pending = [];
          for (let i = 0; i < 6; i++) pending.push(await challenge(u));
          assert.equal(
            await db.mfaChallenge.count({ where: { userId: u.id } }),
            5,
          );
          assert.equal(await mfa.challengeOwner(hash(pending[0])), null);
          const before = await db.userMfa.findUnique({
            where: { userId: u.id },
          });
          const codes = await db.mfaRecoveryCode.findMany({
            where: { userId: u.id },
            orderBy: { id: "asc" },
          });
          const service = new MfaService(mfa, new AuthService(identity));
          await service.cancel(pending[5]);
          await service.cancel(pending[5]);
          for (const invalid of [null, "", "%", "A".repeat(64), token()])
            await service.cancel(invalid);
          assert.equal(await mfa.challengeOwner(hash(pending[5])), null);
          assert.equal(await mfa.challengeOwner(hash(pending[4])), u.id);
          assert.equal(await mfa.challengeOwner(hash(other)), b.id);
          await assert.rejects(
            verify(pending[5], { type: "recovery", code: f.codes[0] }),
            (e) => e.getStatus() === 401,
          );
          await assert.rejects(
            verify(pending[5], {
              type: "totp",
              code: totpAt(f.secret, Math.floor(Date.now() / 30000) + 1),
            }),
            (e) => e.getStatus() === 401,
          );
          assert.equal(await db.session.count({ where: { userId: u.id } }), 0);
          assert.deepEqual(
            await db.userMfa.findUnique({ where: { userId: u.id } }),
            before,
          );
          assert.deepEqual(
            await db.mfaRecoveryCode.findMany({
              where: { userId: u.id },
              orderBy: { id: "asc" },
            }),
            codes,
          );
          await verify(pending[4], { type: "recovery", code: f.codes[0] });
          f.secret.fill(0);
        },
      );
      for (const first of ["verify", "cancel"])
        await t.test(
          `deterministic ${first}-first verify/cancel serial outcome`,
          async () => {
            const u = await fixture(),
              f = await enroll(u),
              c = await challenge(u);
            const initialStep = (
              await db.userMfa.findUnique({ where: { userId: u.id } })
            ).lastUsedStep;
            const locked = deferred(),
              release = deferred();
            const holder = db.$transaction(
              async (tx) => {
                await tx.$queryRaw`SELECT id FROM users WHERE id=${u.id}::uuid FOR UPDATE`;
                locked.resolve();
                await release.promise;
              },
              { timeout: 15000 },
            );
            await locked.promise;
            const input = { type: "recovery", code: f.codes[0] };
            const cancel = () =>
              new MfaService(mfa, new AuthService(identity)).cancel(c);
            const waiters = async (count) => {
              const deadline = Date.now() + 5000;
              while (Date.now() < deadline) {
                const [row] =
                  await db.$queryRaw`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND usename='nexora_app' AND wait_event_type='Lock' AND query LIKE '%FROM users%'`;
                if (row.n >= count) return;
                await new Promise((resolve) => setImmediate(resolve));
              }
              assert.fail("expected actual user-row lock waiters");
            };
            let one, two;
            try {
              one = Promise.allSettled([
                first === "verify" ? verify(c, input) : cancel(),
              ]);
              await waiters(1);
              two = Promise.allSettled([
                first === "verify" ? cancel() : verify(c, input),
              ]);
              await waiters(2);
            } finally {
              release.resolve();
              await holder;
            }
            const [r1] = await one,
              [r2] = await two;
            assert.equal(r1.status, "fulfilled");
            assert.equal(
              r2.status,
              first === "verify" ? "fulfilled" : "rejected",
            );
            if (first === "cancel") assert.equal(r2.reason.getStatus(), 401);
            assert.equal(
              await db.mfaChallenge.count({ where: { tokenHash: hash(c) } }),
              0,
            );
            assert.equal(
              await db.session.count({
                where: { userId: u.id, authLevel: "MFA" },
              }),
              first === "verify" ? 1 : 0,
            );
            assert.equal(
              await db.mfaRecoveryCode.count({
                where: { userId: u.id, usedAt: { not: null } },
              }),
              first === "verify" ? 1 : 0,
            );
            assert.equal(
              (await db.userMfa.findUnique({ where: { userId: u.id } }))
                .lastUsedStep,
              initialStep,
            );
            if (first === "verify")
              assert.ok(
                await new AuthService(identity).validateSession(r1.value.token),
              );
            f.secret.fill(0);
          },
        );
      stage = "NEST_HTTP";
      class FutureAdmin {
        probe() {
          return { ok: true };
        }
      }
      Controller("admin/future-probe")(FutureAdmin);
      Get()(
        FutureAdmin.prototype,
        "probe",
        Object.getOwnPropertyDescriptor(FutureAdmin.prototype, "probe"),
      );
      Public()(
        FutureAdmin.prototype,
        "probe",
        Object.getOwnPropertyDescriptor(FutureAdmin.prototype, "probe"),
      );
      class TestModule {}
      Module({ imports: [AppModule], controllers: [FutureAdmin] })(TestModule);
      app = await NestFactory.create(TestModule, {
        logger: false,
        abortOnError: false,
      });
      configure(app);
      await app.listen(0, "127.0.0.1");
      const base = await app.getUrl(),
        origin = loadConfig(process.env).trustedOrigins[0];
      const request = (
        path,
        body,
        cookie,
        requestOrigin = origin,
        method = "POST",
      ) =>
        fetch(base + path, {
          method,
          headers: {
            "content-type": "application/json",
            ...(requestOrigin ? { origin: requestOrigin } : {}),
            ...(cookie ? { cookie } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      await t.test(
        "HTTP cancellation persistence failure, retry, Origin and cancelled-token replay",
        async () => {
          const u = await fixture(),
            f = await enroll(u),
            c = await challenge(u),
            cookie = "nexora_mfa_token=" + c;
          for (const o of [null, "http://attacker.example"])
            assert.equal(
              (await request("/api/auth/mfa/cancel", {}, cookie, o)).status,
              403,
            );
          await db.$executeRawUnsafe(
            "CREATE FUNCTION reject_cancel() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled cancellation failure'; END $$",
          );
          await db.$executeRawUnsafe(
            "CREATE TRIGGER reject_cancel BEFORE DELETE ON mfa_challenges FOR EACH ROW EXECUTE FUNCTION reject_cancel()",
          );
          try {
            const failed = await request("/api/auth/mfa/cancel", {}, cookie);
            assert.equal(failed.status, 500);
            assert.equal(failed.headers.get("set-cookie"), null);
            assert.equal(failed.headers.get("cache-control"), "no-store");
            const error = await failed.json();
            assert.equal(error.code, "INTERNAL_ERROR");
            assert.deepEqual(Object.keys(error).sort(), [
              "code",
              "message",
              "requestId",
            ]);
            assert.ok(!JSON.stringify(error).includes(c));
            assert.equal(await mfa.challengeOwner(hash(c)), u.id);
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER reject_cancel ON mfa_challenges",
            );
            await db.$executeRawUnsafe("DROP FUNCTION reject_cancel()");
          }
          const cancelled = await request("/api/auth/mfa/cancel", {}, cookie);
          assert.equal(cancelled.status, 200);
          assert.match(
            cancelled.headers.get("set-cookie"),
            /nexora_mfa_token=;.*Max-Age=0;.*Path=\/api\/auth\/mfa/,
          );
          assert.equal(await mfa.challengeOwner(hash(c)), null);
          const replay = await request(
            "/api/auth/mfa/verify",
            { type: "recovery", code: f.codes[0] },
            cookie,
          );
          assert.equal(replay.status, 401);
          assert.equal(await db.session.count({ where: { userId: u.id } }), 0);
          for (const missing of [undefined, "nexora_mfa_token=%", cookie])
            assert.equal(
              (await request("/api/auth/mfa/cancel", {}, missing)).status,
              200,
            );
          f.secret.fill(0);
        },
      );
      await t.test(
        "HTTP ADMIN two-step cookies, Origin, replay, recovery and DB assurance; OPERATOR unchanged",
        async () => {
          const login = await request("/api/auth/login", {
            username: b.username,
            password,
          });
          assert.equal(login.status, 200);
          assert.deepEqual(await login.json(), { mfaRequired: true });
          const cookies = login.headers.getSetCookie(),
            pending = cookies.find((c) => c.startsWith("nexora_mfa_token="));
          assert.match(pending, /HttpOnly/);
          assert.match(pending, /SameSite=Strict/);
          assert.match(pending, /Path=\/api\/auth\/mfa/);
          assert.match(pending, /Max-Age=300/);
          assert.doesNotMatch(pending, /; Secure/);
          assert.ok(
            cookies.every((c) => !/^nexora_session=[a-f0-9]{64}/.test(c)),
          );
          const cookie = pending.split(";")[0],
            input = recovery(bf);
          for (const o of [null, "http://attacker.example"])
            assert.equal(
              (await request("/api/auth/mfa/verify", input, cookie, o)).status,
              403,
            );
          for (const raw of [
            undefined,
            "nexora_mfa_token=%",
            "nexora_mfa_token=" + token(),
          ]) {
            const r = await request("/api/auth/mfa/verify", input, raw);
            assert.equal(r.status, 401);
            assert.equal(r.headers.get("cache-control"), "no-store");
          }
          assert.equal(
            (
              await request(
                "/api/auth/mfa/verify",
                { ...input, authLevel: "MFA" },
                cookie,
              )
            ).status,
            400,
          );
          const verified = await request("/api/auth/mfa/verify", input, cookie);
          assert.equal(verified.status, 200);
          assert.deepEqual(Object.keys(await verified.json()), ["user"]);
          const session = verified.headers
            .getSetCookie()
            .find((c) => /^nexora_session=.+/.test(c))
            .split(";")[0];
          assert.equal(
            (
              await request(
                "/api/admin/users",
                undefined,
                session,
                origin,
                "GET",
              )
            ).status,
            200,
          );
          assert.equal(
            (await request("/api/auth/mfa/verify", input, cookie)).status,
            401,
          );
          const old = token();
          await db.session.create({
            data: {
              userId: b.id,
              tokenHash: hash(old),
              expiresAt: new Date(Date.now() + 60000),
            },
          });
          assert.equal(
            (
              await request(
                "/api/admin/users",
                undefined,
                "nexora_session=" + old,
                origin,
                "GET",
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                "/api/admin/future-probe",
                undefined,
                "nexora_session=" + old,
                origin,
                "GET",
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await request(
                "/api/admin/future-probe",
                undefined,
                session,
                origin,
                "GET",
              )
            ).status,
            200,
          );
          assert.equal(
            (
              await request(
                "/api/admin/future-probe",
                undefined,
                undefined,
                origin,
                "GET",
              )
            ).status,
            401,
          );
          const opLogin = await request("/api/auth/login", {
            username: op.username,
            password,
          });
          assert.equal(opLogin.status, 200);
          assert.ok((await opLogin.json()).user);
          const opCookie = opLogin.headers
            .getSetCookie()
            .find((c) => c.startsWith("nexora_session="))
            .split(";")[0];
          assert.equal(
            (
              await request(
                "/api/admin/users",
                undefined,
                opCookie,
                origin,
                "GET",
              )
            ).status,
            403,
          );
          const noEnrollment = await request("/api/auth/login", {
            username: unenrolled.username,
            password,
          });
          assert.equal(noEnrollment.status, 403);
          assert.equal(
            (await noEnrollment.json()).code,
            "MFA_ENROLLMENT_REQUIRED",
          );
          assert.equal(noEnrollment.headers.get("set-cookie"), null);
          const wrong = await request("/api/auth/login", {
            username: unenrolled.username,
            password: "wrong",
          });
          assert.equal(wrong.status, 401);
          assert.equal((await wrong.json()).code, "AUTHENTICATION_FAILED");
          await db.$executeRawUnsafe(
            "CREATE FUNCTION reject_logout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled logout failure'; END $$",
          );
          await db.$executeRawUnsafe(
            "CREATE TRIGGER reject_logout BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION reject_logout()",
          );
          try {
            for (const current of [session, opCookie]) {
              const failed = await request("/api/auth/logout", {}, current);
              assert.equal(failed.status, 500);
              assert.equal(failed.headers.get("set-cookie"), null);
              assert.equal((await failed.json()).code, "INTERNAL_ERROR");
              assert.equal(
                (
                  await request(
                    "/api/auth/session",
                    undefined,
                    current,
                    origin,
                    "GET",
                  )
                ).status,
                200,
              );
            }
          } finally {
            await db.$executeRawUnsafe(
              "DROP TRIGGER reject_logout ON sessions",
            );
            await db.$executeRawUnsafe("DROP FUNCTION reject_logout()");
          }
          for (const current of [session, opCookie]) {
            for (const o of [null, "http://attacker.example"])
              assert.equal(
                (await request("/api/auth/logout", {}, current, o)).status,
                403,
              );
            const logout = await request("/api/auth/logout", {}, current);
            assert.equal(logout.status, 200);
            assert.match(
              logout.headers.get("set-cookie"),
              /nexora_session=;.*Max-Age=0/,
            );
            assert.equal(
              (
                await request(
                  "/api/auth/session",
                  undefined,
                  current,
                  origin,
                  "GET",
                )
              ).status,
              401,
            );
          }
          const loggedOut = await request("/api/auth/logout", {}, session);
          assert.equal(loggedOut.status, 200);
          assert.equal(
            (
              await request(
                "/api/admin/users",
                undefined,
                session,
                origin,
                "GET",
              )
            ).status,
            401,
          );
          assert.equal(
            (
              await request("/api/auth/provider/login", {
                username: b.username,
                password,
              })
            ).status,
            404,
          );
        },
      );
      af.secret.fill(0);
      bf.secret.fill(0);
    } catch {
      throw new Error("MFA_INTEGRATION_FAILED stage=" + stage);
    } finally {
      await app?.close();
      await identity?.onApplicationShutdown();
      await mfa?.onApplicationShutdown();
      await management?.onApplicationShutdown();
      await db?.$disconnect();
      if (owned) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
      await admin.$disconnect();
      await rm(root, { recursive: true, force: true });
      for (const k of Object.keys(process.env))
        if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  },
);
