const { loginWithMfa } = require("../test/helpers/mfa-fixture.cjs");
require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { NestFactory } = require("@nestjs/core");
const { AppModule } = require("../dist/app.module");
const { configure } = require("../dist/http");
const {
  DatabaseAdapter,
} = require("../dist/health/infrastructure/database.adapter");
const {
  LocalStorage,
} = require("../dist/storage/infrastructure/local-storage");
const {
  FilesService,
} = require("../dist/storage/application/file-storage.port");
test("migrated PostgreSQL, original file catalog and HTTP errors", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL required");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nexora-integration-"));
  process.env.STORAGE_ROOT = root;
  const db = new DatabaseAdapter(process.env.DATABASE_URL);
  let app;
  let blob;
  try {
    assert.equal(await db.isReady(), true);
    const files = new FilesService(new LocalStorage(root), db);
    blob = await files.save(Buffer.from("source workbook bytes"));
    assert.equal(
      (await files.read(blob.id)).toString(),
      "source workbook bytes",
    );
    assert.equal(
      (await db.client.storedFile.findUniqueOrThrow({ where: { id: blob.id } }))
        .sha256,
      blob.sha256,
    );
    app = await NestFactory.create(AppModule, { logger: false });
    configure(app);
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    let res = await fetch(url + "/api/health/ready");
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).checks, {
      database: true,
      storage: true,
    });
    res = await fetch(url + "/api/nonexistent?api_key=never-log-this", {
      headers: {
        authorization: "Bearer never-log-this",
        cookie: "secret=never-log-this",
      },
    });
    assert.equal(res.status, 404);
    const error = await res.json();
    assert.equal(error.code, "NOT_FOUND");
    assert.equal(error.requestId, res.headers.get("x-request-id"));
    assert.ok(!JSON.stringify(error).includes("never-log-this"));
    const offline = new DatabaseAdapter(
      "postgresql://u:p@127.0.0.1:1/db?connect_timeout=1",
    );
    assert.equal(await offline.isReady(), false);
    await offline.onApplicationShutdown();
  } finally {
    if (app) await app.close();
    if (blob) await db.client.storedFile.delete({ where: { id: blob.id } });
    await db.onApplicationShutdown();
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("database session revocation is idempotent and outage errors propagate", async () => {
  const {
    IdentityDatabaseAdapter,
  } = require("../dist/identity/infrastructure/identity.adapter");
  const { randomUUID, randomBytes } = require("node:crypto");
  assert.ok(process.env.DATABASE_URL);
  const adapter = new IdentityDatabaseAdapter(process.env.DATABASE_URL);
  const id = randomUUID();
  const tokenHash = randomBytes(32).toString("hex");
  try {
    await adapter.client.user.create({
      data: {
        id,
        username: `revoke-${id.slice(0, 8)}`,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    await adapter.createSession(id, tokenHash, new Date(Date.now() + 60000));
    assert.ok(await adapter.findSessionByTokenHash(tokenHash));
    await adapter.deleteSessionByTokenHash(tokenHash);
    assert.equal(await adapter.findSessionByTokenHash(tokenHash), null);
    await adapter.deleteSessionByTokenHash(tokenHash);
    const offline = new IdentityDatabaseAdapter(
      "postgresql://u:p@127.0.0.1:1/db?connect_timeout=1",
    );
    try {
      await assert.rejects(offline.deleteSessionByTokenHash(tokenHash));
    } finally {
      await offline.onApplicationShutdown();
    }
  } finally {
    await adapter.client.user.deleteMany({ where: { id } });
    await adapter.onApplicationShutdown();
  }
});

test("real unified identities keep local Login eligibility separate from generic Operator sessions", async () => {
  const {
    IdentityDatabaseAdapter,
  } = require("../dist/identity/infrastructure/identity.adapter");
  const { AuthService } = require("../dist/identity/application/auth.service");
  const {
    SessionGuard,
  } = require("../dist/identity/presentation/session.guard");
  const {
    provisionUser,
  } = require("../dist/identity/infrastructure/user-provisioner");
  const { randomUUID, randomBytes, createHash } = require("node:crypto");
  const adapter = new IdentityDatabaseAdapter(process.env.DATABASE_URL);
  const prefix = `identity-${randomUUID().slice(0, 8)}`;
  const ids = [];
  const service = new AuthService(adapter);
  const tokens = [];
  const createToken = async (id, expired = false) => {
    const token = randomBytes(32).toString("hex");
    await adapter.createSession(
      id,
      createHash("sha256").update(token).digest("hex"),
      new Date(expired ? 0 : Date.now() + 60000),
    );
    tokens.push(token);
    return token;
  };
  const guard = new SessionGuard(service, { getAllAndOverride: () => false });
  const guarded = (token) =>
    guard.canActivate({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { cookie: `nexora_session=${token}` } }),
      }),
    });
  try {
    await provisionUser(
      process.env.DATABASE_URL,
      prefix + "-admin",
      "IntegrationPass123!",
    );
    const admin = await adapter.client.user.findUniqueOrThrow({
      where: { username: prefix + "-admin" },
      include: { credential: true },
    });
    ids.push(admin.id);
    assert.equal(admin.role, "ADMIN");
    assert.equal(admin.status, "ACTIVE");
    assert.ok(admin.credential);
    await assert.rejects(
      adapter.client.user.create({
        data: {
          username: prefix + "-atomic-failure",
          role: "ADMIN",
          status: "ACTIVE",
          credential: { create: { passwordHash: "x".repeat(256) } },
        },
      }),
    );
    assert.equal(
      await adapter.client.user.findUnique({
        where: { username: prefix + "-atomic-failure" },
      }),
      null,
    );
    await assert.rejects(
      provisionUser(
        process.env.DATABASE_URL,
        admin.username,
        "IntegrationPass123!",
      ),
    );
    const logged = await loginWithMfa(
      adapter,
      admin.username,
      "IntegrationPass123!",
    );
    assert.equal(logged.user.id, admin.id);
    await assert.rejects(
      service.login(admin.username, "wrong"),
      (e) => e.getStatus() === 401,
    );
    for (const [suffix, role, status] of [
      ["no-credential", "ADMIN", "ACTIVE"],
      ["operator", "OPERATOR", "ACTIVE"],
      ["disabled", "OPERATOR", "DISABLED"],
    ]) {
      const user = await adapter.client.user.create({
        data: { username: prefix + "-" + suffix, role, status },
      });
      ids.push(user.id);
      assert.equal(
        await adapter.client.userCredential.findUnique({
          where: { userId: user.id },
        }),
        null,
      );
      await assert.rejects(
        service.login(user.username, "IntegrationPass123!"),
        (e) => e.getStatus() === 401,
      );
      const token = await createToken(user.id);
      if (status === "ACTIVE") assert.equal(await guarded(token), true);
      else await assert.rejects(guarded(token), (e) => e.getStatus() === 401);
      const expired = await createToken(user.id, true);
      await assert.rejects(guarded(expired), (e) => e.getStatus() === 401);
    }
    const operator = ids[2];
    const first = await createToken(operator),
      second = await createToken(operator);
    assert.equal(await guarded(first), true);
    assert.equal(await guarded(second), true);
    await service.logout(first);
    await assert.rejects(guarded(first), (e) => e.getStatus() === 401);
    assert.equal(await guarded(second), true);
    await service.logout(first);
    await adapter.client.user.update({
      where: { id: admin.id },
      data: { status: "DISABLED" },
    });
    await assert.rejects(guarded(logged.token), (e) => e.getStatus() === 401);
    await assert.rejects(
      service.login(admin.username, "IntegrationPass123!"),
      (e) => e.getStatus() === 401,
    );
  } finally {
    await adapter.client.user.deleteMany({ where: { id: { in: ids } } });
    await adapter.onApplicationShutdown();
  }
});
