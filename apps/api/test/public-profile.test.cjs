const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadConfig } = require("../dist/config");
const base = {
  DATABASE_URL: "postgresql://fixture:fixture@localhost:5432/fixture",
  STORAGE_ROOT: "/tmp/nexora-public-test",
};
const publicEnv = {
  ...base,
  NEXORA_DEPLOYMENT_PROFILE: "PUBLIC_HTTPS",
  PUBLIC_ORIGIN: "https://nexora.example.test",
  ALLOWED_HOSTS: "nexora.example.test",
  ALLOWED_ORIGINS: "https://nexora.example.test",
  TRUSTED_PROXY_CIDRS: "172.30.10.2/32,172.30.11.3/32",
};
test("explicit public profile fails closed on incomplete configuration, never NODE_ENV fallback", () => {
  for (const input of [
    { ...base, NEXORA_DEPLOYMENT_PROFILE: "other" },
    { ...base, NEXORA_DEPLOYMENT_PROFILE: "PUBLIC_HTTPS" },
    { ...publicEnv, PUBLIC_ORIGIN: "http://nexora.example.test" },
    { ...publicEnv, ALLOWED_ORIGINS: "" },
    { ...publicEnv, ALLOWED_ORIGINS: "http://nexora.example.test" },
    { ...publicEnv, ALLOWED_HOSTS: "*" },
    { ...publicEnv, ALLOWED_HOSTS: "localhost" },
    { ...publicEnv, TRUSTED_PROXY_CIDRS: "" },
    { ...publicEnv, TRUSTED_PROXY_CIDRS: "0.0.0.0/0" },
    { ...publicEnv, TRUSTED_PROXY_CIDRS: "172.30.10.2/banana" },
    { ...publicEnv, API_DOCS_ENABLED: "true" },
  ])
    assert.throws(() => loadConfig(input));
  const local = loadConfig({ ...base, NODE_ENV: "production" });
  assert.equal(local.deployment.profile, "LOCAL");
  assert.equal(local.deployment.secureCookies, false);
  const valid = loadConfig(publicEnv);
  assert.equal(valid.deployment.profile, "PUBLIC_HTTPS");
  assert.equal(valid.deployment.secureCookies, true);
  assert.equal(valid.deployment.publicOrigin, publicEnv.PUBLIC_ORIGIN);
  assert.deepEqual(valid.trustedOrigins, [publicEnv.PUBLIC_ORIGIN]);
});
module.exports = { publicEnv };
const {
  AuthController,
} = require("../dist/identity/presentation/auth.controller");
test("every cookie issuance and deletion follows explicit profile, not spoofed headers", async () => {
  for (const env of [base, publicEnv]) {
    const config = loadConfig(env),
      cookies = [];
    let pending = false;
    const auth = {
      login: async () =>
        pending
          ? { mfaRequired: true, challengeToken: "a".repeat(64) }
          : {
              token: "b".repeat(64),
              user: { id: "fixture", username: "fixture" },
            },
      logout: async () => {},
    };
    const mfa = {
      verify: async () => ({
        token: "c".repeat(64),
        user: { id: "fixture", username: "fixture" },
      }),
      cancel: async () => {},
    };
    const controller = new AuthController(auth, mfa, config);
    const res = {
      setHeader() {},
      cookie(name, value, options) {
        cookies.push({ name, value, options });
      },
    };
    const req = {
      headers: {
        cookie:
          "nexora_mfa_token=" +
          "a".repeat(64) +
          "; nexora_session=" +
          "b".repeat(64),
        "x-forwarded-proto": "http",
        "x-forwarded-host": "evil.test",
      },
      secure: false,
    };
    await controller.login({}, res);
    pending = true;
    await controller.login({}, res);
    await controller.verifyMfa(req, { type: "totp", code: "123456" }, res);
    await controller.cancelMfa(req, res);
    await controller.logout(req, res);
    assert.equal(cookies.length, 7);
    for (const { name, options } of cookies) {
      assert.equal(options.secure, env === publicEnv);
      assert.equal(options.httpOnly, true);
      assert.equal(
        options.path,
        name === "nexora_session" ? "/" : "/api/auth/mfa",
      );
      assert.equal(
        options.sameSite,
        name === "nexora_session" ? "lax" : "strict",
      );
    }
    assert.equal(cookies.filter((c) => c.options.maxAge === 0).length, 4);
  }
});
const {
  UserManagementService,
} = require("../dist/identity/application/user-management.service");
test("setup links use canonical HTTPS origin even for another approved request origin", async () => {
  const port = {
    createOperator: async () => ({ id: "fixture", username: "new_operator" }),
  };
  const svc = new UserManagementService(
    port,
    {},
    ["https://nexora.example.test", "https://alias.example.test"],
    "https://nexora.example.test",
  );
  const result = await svc.createOperator(
    "fixture",
    { username: "new_operator" },
    "https://alias.example.test",
  );
  const link = new URL(result.setupUrl);
  assert.equal(link.origin, "https://nexora.example.test");
  assert.equal(link.pathname, "/setup");
  assert.match(link.hash, /^#token=[a-f0-9]{64}$/);
  assert.equal(link.search, "");
  await assert.rejects(
    svc.createOperator(
      "fixture",
      { username: "new_operator" },
      "https://evil.example.test",
    ),
  );
});
test("actual HTTP proxy attribution ignores untrusted spoofing and honors only configured hop", async () => {
  require("reflect-metadata");
  const { NestFactory } = require("@nestjs/core");
  const { Module, Controller, Get, Req } = require("@nestjs/common");
  const { configure } = require("../dist/http");
  class Probe {
    run(req) {
      return { ip: req.ip, hostname: req.hostname, secure: req.secure };
    }
  }
  Controller("test-proxy")(Probe);
  Get()(
    Probe.prototype,
    "run",
    Object.getOwnPropertyDescriptor(Probe.prototype, "run"),
  );
  Req()(Probe.prototype, "run", 0);
  class TestModule {}
  Module({ controllers: [Probe] })(TestModule);
  const saved = { ...process.env };
  try {
    for (const trusted of ["172.30.11.3/32", "127.0.0.1/32"]) {
      Object.assign(process.env, publicEnv, { TRUSTED_PROXY_CIDRS: trusted });
      const app = await NestFactory.create(TestModule, { logger: false });
      try {
        configure(app);
        await app.listen(0, "127.0.0.1");
        const response = await fetch((await app.getUrl()) + "/api/test-proxy", {
          headers: {
            "x-forwarded-for": "192.0.2.1, 203.0.113.7",
            "x-forwarded-host": "evil.example.test",
            "x-forwarded-proto": "https",
          },
        });
        assert.equal(response.status, 200);
        const data = await response.json();
        if (trusted.startsWith("127.")) {
          assert.equal(data.ip, "203.0.113.7");
          assert.equal(data.secure, true);
        } else {
          assert.match(data.ip, /127\.0\.0\.1$/);
          assert.equal(data.secure, false);
          assert.notEqual(data.hostname, "evil.example.test");
        }
      } finally {
        await app.close();
      }
    }
  } finally {
    for (const name of Object.keys(process.env))
      if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});
