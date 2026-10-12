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
    const logged = await service.login(admin.username, "IntegrationPass123!");
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

test("external identities enforce unique bindings, prevent duplicate subjects, and enable fake-provider OPERATOR sessions", async () => {
  const {
    IdentityDatabaseAdapter,
  } = require("../dist/identity/infrastructure/identity.adapter");
  const { AuthService } = require("../dist/identity/application/auth.service");
  const {
    SessionGuard,
  } = require("../dist/identity/presentation/session.guard");
  const { randomUUID } = require("node:crypto");

  assert.ok(process.env.DATABASE_URL, "DATABASE_URL required");
  const adapter = new IdentityDatabaseAdapter(process.env.DATABASE_URL);
  const service = new AuthService(adapter);
  const guard = new SessionGuard(service, { getAllAndOverride: () => false });
  const guarded = (token) =>
    guard.canActivate({
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { cookie: `nexora_session=${token}` } }),
      }),
    });

  const prefix = `extid-${randomUUID().slice(0, 8)}`;
  const userIds = [];

  try {
    // 1. Create test users: ACTIVE OPERATOR, DISABLED OPERATOR, and ACTIVE ADMIN
    const activeOp = await adapter.client.user.create({
      data: {
        username: `${prefix}-op-active`,
        role: "OPERATOR",
        status: "ACTIVE",
        externalIdentities: {
          create: {
            provider: "uniship",
            providerSubject: `${prefix}-subject-active`,
          },
        },
      },
      include: { externalIdentities: true },
    });
    userIds.push(activeOp.id);

    const disabledOp = await adapter.client.user.create({
      data: {
        username: `${prefix}-op-disabled`,
        role: "OPERATOR",
        status: "DISABLED",
        externalIdentities: {
          create: {
            provider: "uniship",
            providerSubject: `${prefix}-subject-disabled`,
          },
        },
      },
      include: { externalIdentities: true },
    });
    userIds.push(disabledOp.id);

    const activeAdmin = await adapter.client.user.create({
      data: {
        username: `${prefix}-admin-active`,
        role: "ADMIN",
        status: "ACTIVE",
        externalIdentities: {
          create: {
            provider: "uniship",
            providerSubject: `${prefix}-subject-admin`,
          },
        },
      },
      include: { externalIdentities: true },
    });
    userIds.push(activeAdmin.id);

    // Verify neither operator has rows in user_credentials
    const opCredentials = await adapter.client.userCredential.findMany({
      where: { userId: { in: [activeOp.id, disabledOp.id] } },
    });
    assert.equal(opCredentials.length, 0);

    // 2. Database constraints & duplicate prevention
    // Duplicate (provider, providerSubject) must be rejected by PostgreSQL uniqueness
    const duplicateUser = await adapter.client.user.create({
      data: {
        username: `${prefix}-duplicate-subject`,
        role: "OPERATOR",
        status: "ACTIVE",
      },
    });
    userIds.push(duplicateUser.id);

    await assert.rejects(
      adapter.client.externalIdentity.create({
        data: {
          userId: duplicateUser.id,
          provider: "uniship",
          providerSubject: `${prefix}-subject-active`,
        },
      }),
      (err) => err.code === "P2002",
    );

    // Duplicate (userId, provider) must be rejected
    await assert.rejects(
      adapter.client.externalIdentity.create({
        data: {
          userId: activeOp.id,
          provider: "uniship",
          providerSubject: `${prefix}-different-subject`,
        },
      }),
      (err) => err.code === "P2002",
    );

    // Provider check constraint: only 'uniship' permitted
    await assert.rejects(
      adapter.client.$executeRaw`
        INSERT INTO external_identities (id, user_id, provider, provider_subject, created_at, updated_at)
        VALUES (gen_random_uuid(), ${duplicateUser.id}::uuid, 'unsupported', 'some-subj', NOW(), NOW())
      `,
    );

    // Subject format check constraint: empty or untrimmed rejected
    await assert.rejects(
      adapter.client.$executeRaw`
        INSERT INTO external_identities (id, user_id, provider, provider_subject, created_at, updated_at)
        VALUES (gen_random_uuid(), ${duplicateUser.id}::uuid, 'uniship', '  spaces  ', NOW(), NOW())
      `,
    );

    // 3. Fake-provider server-side authentication flow via AuthService.authenticateExternalIdentity
    // Unknown provider subject -> 401 AUTHENTICATION_FAILED
    await assert.rejects(
      service.authenticateExternalIdentity({
        provider: "uniship",
        providerSubject: `${prefix}-unregistered`,
      }),
      (err) =>
        err.getStatus() === 401 &&
        err.getResponse().code === "AUTHENTICATION_FAILED",
    );

    // Disabled operator -> 401 AUTHENTICATION_FAILED
    await assert.rejects(
      service.authenticateExternalIdentity({
        provider: "uniship",
        providerSubject: `${prefix}-subject-disabled`,
      }),
      (err) =>
        err.getStatus() === 401 &&
        err.getResponse().code === "AUTHENTICATION_FAILED",
    );

    // Admin user linked to provider -> 401 AUTHENTICATION_FAILED (ADMIN cannot use operator provider flow)
    await assert.rejects(
      service.authenticateExternalIdentity({
        provider: "uniship",
        providerSubject: `${prefix}-subject-admin`,
      }),
      (err) =>
        err.getStatus() === 401 &&
        err.getResponse().code === "AUTHENTICATION_FAILED",
    );

    // Registered ACTIVE OPERATOR -> Success
    const authResult = await service.authenticateExternalIdentity({
      provider: "uniship",
      providerSubject: `${prefix}-subject-active`,
    });
    assert.ok(authResult.token);
    assert.equal(authResult.user.id, activeOp.id);
    assert.equal(authResult.user.username, activeOp.username);

    // 4. Session validity and SessionGuard activation
    const validated = await service.validateSession(authResult.token);
    assert.deepEqual(validated, {
      id: activeOp.id,
      username: activeOp.username,
    });

    const guardResult = await guarded(authResult.token);
    assert.equal(guardResult, true);

    // 5. Operator cannot use local password login
    await assert.rejects(
      service.login(activeOp.username, "AnyPassword123!"),
      (err) => err.getStatus() === 401,
    );

    // 6. Logout and revocation
    await service.logout(authResult.token);
    assert.equal(await service.validateSession(authResult.token), null);
    await assert.rejects(
      guarded(authResult.token),
      (err) => err.getStatus() === 401,
    );

    // 7. Cascade deletion: deleting user removes external identity row
    const deleteTestUser = await adapter.client.user.create({
      data: {
        username: `${prefix}-cascade-test`,
        role: "OPERATOR",
        status: "ACTIVE",
        externalIdentities: {
          create: {
            provider: "uniship",
            providerSubject: `${prefix}-cascade-subject`,
          },
        },
      },
    });
    const externalBefore = await adapter.client.externalIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: "uniship",
          providerSubject: `${prefix}-cascade-subject`,
        },
      },
    });
    assert.ok(externalBefore);
    await adapter.client.user.delete({ where: { id: deleteTestUser.id } });
    const externalAfter = await adapter.client.externalIdentity.findUnique({
      where: {
        provider_providerSubject: {
          provider: "uniship",
          providerSubject: `${prefix}-cascade-subject`,
        },
      },
    });
    assert.equal(externalAfter, null);
  } finally {
    if (userIds.length > 0) {
      await adapter.client.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await adapter.onApplicationShutdown();
  }
});

test("end-to-end provider login: HTTP client -> NestJS endpoint -> Uniship adapter -> local mock provider -> DB external identity -> session -> protected API", async () => {
  const http = require("node:http");
  const {
    IdentityDatabaseAdapter,
  } = require("../dist/identity/infrastructure/identity.adapter");
  const {
    UnishipAuthAdapter,
  } = require("../dist/identity/infrastructure/uniship-auth.adapter");
  const { AuthService } = require("../dist/identity/application/auth.service");
  const {
    AuthController,
  } = require("../dist/identity/presentation/auth.controller");
  const {
    SessionGuard,
  } = require("../dist/identity/presentation/session.guard");
  const { OriginGuard } = require("../dist/identity/presentation/origin.guard");
  const { configure } = require("../dist/http");
  const { Module } = require("@nestjs/common");
  const { NestFactory, APP_GUARD } = require("@nestjs/core");
  const { randomUUID } = require("node:crypto");

  assert.ok(process.env.DATABASE_URL, "DATABASE_URL required");
  const dbAdapter = new IdentityDatabaseAdapter(process.env.DATABASE_URL);

  let mockMode = "success";
  let activeSubject = "";
  let disabledSubject = "";

  const mockServer = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const json = JSON.parse(body);
      if (mockMode === "invalid-creds" || json.password === "wrong") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            non_field_errors: ["Unable to log in with provided credentials."],
          }),
        );
      } else if (mockMode === "unregistered") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token: "tok_unreg", userid: 999999 }));
      } else if (mockMode === "disabled") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token: "tok_dis", userid: disabledSubject }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ token: "tok_ok", userid: activeSubject }));
      }
    });
  });

  const mockPort = await new Promise((resolve) => {
    mockServer.listen(0, "127.0.0.1", () => {
      resolve(mockServer.address().port);
    });
  });
  const mockProviderUrl = `http://127.0.0.1:${mockPort}`;

  const prefix = `pve2e-${randomUUID().slice(0, 8)}`;
  activeSubject = `${prefix}-subj-active`;
  disabledSubject = `${prefix}-subj-disabled`;
  const userIds = [];

  let app;
  try {
    // 1. Seed active and disabled operators in database
    const activeOp = await dbAdapter.client.user.create({
      data: {
        username: `${prefix}-op`,
        role: "OPERATOR",
        status: "ACTIVE",
        externalIdentities: {
          create: {
            provider: "uniship",
            providerSubject: activeSubject,
          },
        },
      },
    });
    userIds.push(activeOp.id);

    const disabledOp = await dbAdapter.client.user.create({
      data: {
        username: `${prefix}-op-disabled`,
        role: "OPERATOR",
        status: "DISABLED",
        externalIdentities: {
          create: {
            provider: "uniship",
            providerSubject: disabledSubject,
          },
        },
      },
    });
    userIds.push(disabledOp.id);

    // 2. Set up real Nest HTTP server with UnishipAuthAdapter pointing to mockProviderUrl
    const providerAdapter = new UnishipAuthAdapter({
      apiUrl: mockProviderUrl,
    });
    const authService = new AuthService(dbAdapter, providerAdapter);

    class IntegrationModule {}
    Module({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: "CONFIG",
          useValue: { trustedOrigins: ["http://localhost:3001"] },
        },
        OriginGuard,
        { provide: APP_GUARD, useClass: SessionGuard },
      ],
    })(IntegrationModule);

    app = await NestFactory.create(IntegrationModule, {
      logger: false,
      abortOnError: false,
    });
    configure(app);
    await app.listen(0, "127.0.0.1");
    const appUrl = await app.getUrl();

    // 3. Reject invalid Origin
    const badOriginRes = await fetch(`${appUrl}/api/auth/provider/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://evil.com",
      },
      body: JSON.stringify({ username: "someuser", password: "somepassword" }),
    });
    assert.equal(badOriginRes.status, 403);

    // 4. Reject invalid credentials from provider
    mockMode = "invalid-creds";
    const invalidCredsRes = await fetch(`${appUrl}/api/auth/provider/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
      },
      body: JSON.stringify({ username: "someuser", password: "wrong" }),
    });
    assert.equal(invalidCredsRes.status, 401);
    assert.equal((await invalidCredsRes.json()).code, "AUTHENTICATION_FAILED");
    assert.equal(invalidCredsRes.headers.get("set-cookie"), null);

    // 5. Reject unregistered provider identity
    mockMode = "unregistered";
    const unregRes = await fetch(`${appUrl}/api/auth/provider/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
      },
      body: JSON.stringify({ username: "someuser", password: "goodpassword" }),
    });
    assert.equal(unregRes.status, 401);
    assert.equal((await unregRes.json()).code, "AUTHENTICATION_FAILED");
    assert.equal(unregRes.headers.get("set-cookie"), null);

    // 6. Reject disabled operator
    mockMode = "disabled";
    const disRes = await fetch(`${appUrl}/api/auth/provider/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
      },
      body: JSON.stringify({ username: "someuser", password: "goodpassword" }),
    });
    assert.equal(disRes.status, 401);
    assert.equal((await disRes.json()).code, "AUTHENTICATION_FAILED");
    assert.equal(disRes.headers.get("set-cookie"), null);

    // 7. Successful login for active operator
    mockMode = "success";
    const successRes = await fetch(`${appUrl}/api/auth/provider/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3001",
      },
      body: JSON.stringify({ username: "someuser", password: "goodpassword" }),
    });
    assert.equal(successRes.status, 200);
    const successBody = await successRes.json();
    assert.equal(successBody.user.id, activeOp.id);
    assert.equal(successBody.user.username, activeOp.username);

    // Verify session cookie attributes
    const setCookie = successRes.headers.get("set-cookie");
    assert.ok(setCookie, "set-cookie header must be present");
    assert.ok(setCookie.includes("nexora_session="));
    assert.ok(setCookie.includes("HttpOnly"));
    assert.ok(setCookie.includes("SameSite=Lax"));
    assert.ok(setCookie.includes("Path=/"));
    assert.ok(!setCookie.includes("Secure")); // loopback deployment

    const cookieMatch = /nexora_session=([^;]+)/.exec(setCookie);
    const sessionToken = cookieMatch[1];
    assert.equal(sessionToken.length, 64);

    // 8. Access protected session endpoint with cookie
    const sessionRes = await fetch(`${appUrl}/api/auth/session`, {
      headers: {
        cookie: `nexora_session=${sessionToken}`,
      },
    });
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.authenticated, true);
    assert.equal(sessionData.user.id, activeOp.id);

    // 9. Logout
    const logoutRes = await fetch(`${appUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        origin: "http://localhost:3001",
        cookie: `nexora_session=${sessionToken}`,
      },
    });
    assert.equal(logoutRes.status, 200);

    // 10. Subsequent session verification is rejected
    const afterLogout = await fetch(`${appUrl}/api/auth/session`, {
      headers: {
        cookie: `nexora_session=${sessionToken}`,
      },
    });
    assert.equal(afterLogout.status, 401);
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => mockServer.close(resolve));
    if (userIds.length > 0) {
      await dbAdapter.client.user.deleteMany({
        where: { id: { in: userIds } },
      });
    }
    await dbAdapter.onApplicationShutdown();
  }
});
