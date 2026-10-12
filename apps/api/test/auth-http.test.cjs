require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Module } = require("@nestjs/common");
const { NestFactory, APP_GUARD } = require("@nestjs/core");
const {
  AuthController,
} = require("../dist/identity/presentation/auth.controller");
const { AuthService } = require("../dist/identity/application/auth.service");
const { SessionGuard } = require("../dist/identity/presentation/session.guard");
const { OriginGuard } = require("../dist/identity/presentation/origin.guard");
const { configure } = require("../dist/http");

test("real Nest HTTP rejects Origin/type/session failures and preserves safe error envelopes", async () => {
  const service = new AuthService({
    findUserByUsername: async () => null,
    verifyPassword: async () => false,
    findSessionByTokenHash: async () => null,
    deleteSessionByTokenHash: async () => {
      throw new Error("private database diagnostic");
    },
  });
  class TestModule {}
  Module({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: service },
      {
        provide: "CONFIG",
        useValue: { trustedOrigins: ["http://localhost:3101"] },
      },
      OriginGuard,
      { provide: APP_GUARD, useClass: SessionGuard },
    ],
  })(TestModule);
  const app = await NestFactory.create(TestModule, {
    logger: false,
    abortOnError: false,
  });
  configure(app);
  try {
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    for (const origin of [
      undefined,
      "http://localhost:3000",
      "http://localhost:3001",
      "http://attacker.example",
      "null",
      "http://localhost:3101/path",
    ]) {
      const res = await fetch(url + "/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(origin ? { origin } : {}),
        },
        body: JSON.stringify({ username: "operator", password: "password" }),
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.deepEqual(Object.keys(body).sort(), [
        "code",
        "message",
        "requestId",
      ]);
      assert.equal(body.requestId, res.headers.get("x-request-id"));
      assert.equal(body.code, "FORBIDDEN");
    }
    for (const body of [
      null,
      [],
      {},
      { username: 123, password: "password" },
      { username: "operator", password: {} },
    ]) {
      const res = await fetch(url + "/api/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3101",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).code, "VALIDATION_ERROR");
    }
    const permitted = await fetch(url + "/api/auth/login", {
      method: "POST",
      headers: {
        origin: "http://localhost:3101",
        "content-type": "application/json",
      },
      body: JSON.stringify({ username: "operator", password: "password" }),
    });
    assert.equal(permitted.status, 401);
    for (const cookie of [
      undefined,
      "nexora_session=" + "a".repeat(64),
      "nexora_session=%E0%A4%A",
    ]) {
      const res = await fetch(url + "/api/auth/session", {
        headers: cookie ? { cookie } : {},
      });
      assert.equal(res.status, 401);
    }
    const logout = await fetch(url + "/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost:3101",
        cookie: "nexora_session=" + "a".repeat(64),
      },
    });
    assert.equal(logout.status, 500);
    assert.equal(logout.headers.get("set-cookie"), null);
    assert.equal((await logout.json()).code, "INTERNAL_ERROR");
  } finally {
    await app.close();
  }
});
