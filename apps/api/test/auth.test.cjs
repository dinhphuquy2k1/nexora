const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../dist/identity/application/auth.service");
const {
  SessionGuard,
  extractSessionToken,
} = require("../dist/identity/presentation/session.guard");
const {
  OriginGuard,
  isAllowedOrigin,
} = require("../dist/identity/presentation/origin.guard");
const {
  IS_PUBLIC_KEY,
} = require("../dist/identity/presentation/public.decorator");

function createMockIdentityPort() {
  const users = new Map();
  const sessions = new Map();

  return {
    users,
    sessions,
    async findUserByUsername(username) {
      return users.get(username) || null;
    },
    async findUserById(id) {
      for (const u of users.values()) {
        if (u.id === id && u.isActive) {
          return { id: u.id, username: u.username };
        }
      }
      return null;
    },
    async createSession(userId, tokenHash, expiresAt) {
      const session = {
        id: "sess-" + Math.random().toString(36).slice(2),
        userId,
        tokenHash,
        expiresAt,
        createdAt: new Date(),
      };
      sessions.set(tokenHash, session);
      return session;
    },
    async findSessionByTokenHash(tokenHash) {
      const session = sessions.get(tokenHash);
      if (!session) return null;
      let user = null;
      for (const u of users.values()) {
        if (u.id === session.userId && u.isActive) {
          user = { id: u.id, username: u.username };
          break;
        }
      }
      if (!user) return null;
      return { session, user };
    },
    async deleteSessionByTokenHash(tokenHash) {
      sessions.delete(tokenHash);
    },
    async deleteExpiredSessions() {
      let count = 0;
      const now = new Date();
      for (const [k, v] of sessions.entries()) {
        if (v.expiresAt < now) {
          sessions.delete(k);
          count++;
        }
      }
      return count;
    },
    async verifyPassword(password, passwordHash) {
      return password === passwordHash.replace("mock-hash-", "");
    },
  };
}

function createMockReflector(isPublic = false) {
  return {
    getAllAndOverride(key) {
      if (key === IS_PUBLIC_KEY) {
        return isPublic;
      }
      return false;
    },
  };
}

test("AuthService handles validation and generic authentication errors", async () => {
  const port = createMockIdentityPort();
  const auth = new AuthService(port);

  // Missing fields
  await assert.rejects(
    auth.login("", ""),
    (err) =>
      err.getStatus() === 400 && err.getResponse().code === "VALIDATION_ERROR",
  );

  // Non-existent user
  await assert.rejects(
    auth.login("nonexistent", "pass123", "1.1.1.1"),
    (err) =>
      err.getStatus() === 401 &&
      err.getResponse().code === "UNAUTHORIZED" &&
      err.getResponse().message ===
        "Tên đăng nhập hoặc mật khẩu không chính xác",
  );

  // Disabled user
  port.users.set("disabled_user", {
    id: "u-disabled",
    username: "disabled_user",
    passwordHash: "mock-hash-secret123",
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await assert.rejects(
    auth.login("disabled_user", "secret123", "1.1.1.1"),
    (err) => err.getStatus() === 401,
  );
});

test("AuthService rate limits consecutive failed login attempts and clears on success", async () => {
  const port = createMockIdentityPort();
  const auth = new AuthService(port);
  const ip = "10.0.0.99";

  // 5 failures
  for (let i = 0; i < 5; i++) {
    await assert.rejects(
      auth.login("victim", "wrong", ip),
      (err) => err.getStatus() === 401,
    );
  }

  // 6th attempt is throttled
  await assert.rejects(
    auth.login("victim", "wrong", ip),
    (err) =>
      err.getStatus() === 429 && err.getResponse().code === "TOO_MANY_REQUESTS",
  );

  // Successful login on different user clears their own counter
  port.users.set("validuser", {
    id: "u-valid",
    username: "validuser",
    passwordHash: "mock-hash-goodpass",
    isActive: true,
  });
  const res = await auth.login("validuser", "goodpass", ip);
  assert.equal(res.user.username, "validuser");
});

test("AuthService authenticates valid user, creates session, and validates lifecycle", async () => {
  const port = createMockIdentityPort();
  const auth = new AuthService(port);

  port.users.set("operator", {
    id: "u-123",
    username: "operator",
    passwordHash: "mock-hash-securepass",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Successful login
  const result = await auth.login("operator", "securepass", "127.0.0.1");
  assert.equal(result.user.username, "operator");
  assert.equal(typeof result.token, "string");
  assert.equal(result.token.length, 64);
  assert.equal(port.sessions.size, 1);

  // Validate active session
  const validatedUser = await auth.validateSession(result.token);
  assert.notEqual(validatedUser, null);
  assert.equal(validatedUser.username, "operator");

  // Invalidate / logout
  await auth.logout(result.token);
  assert.equal(port.sessions.size, 0);

  // Validating revoked token returns null
  const afterLogout = await auth.validateSession(result.token);
  assert.equal(afterLogout, null);

  // Invalid tokens return null
  assert.equal(await auth.validateSession("invalid-token"), null);
  assert.equal(await auth.validateSession(""), null);
});

test("AuthService handles expired session deletion failure without unhandled rejection (I2)", async () => {
  const port = createMockIdentityPort();
  // Override deleteSessionByTokenHash to reject
  port.deleteSessionByTokenHash = async () => {
    throw new Error("Simulated DB connection failure during session cleanup");
  };

  const auth = new AuthService(port);

  port.users.set("user_exp", {
    id: "u-exp",
    username: "user_exp",
    passwordHash: "mock-hash-p",
    isActive: true,
  });

  // Create an expired session directly
  const crypto = require("node:crypto");
  const rawToken = "a".repeat(64);
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  port.sessions.set(tokenHash, {
    id: "sess-expired",
    userId: "u-exp",
    tokenHash,
    expiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
  });

  // Validating expired session should return null and NOT throw unhandled rejection
  const result = await auth.validateSession(rawToken);
  assert.equal(result, null);
});

test("extractSessionToken safely handles malformed cookies without throwing (m1)", () => {
  assert.equal(extractSessionToken(undefined), null);
  assert.equal(extractSessionToken("foo=bar; other=1"), null);
  assert.equal(
    extractSessionToken("foo=bar; nexora_session=abc123token; other=1"),
    "abc123token",
  );
  // Malformed percent-encoded cookie
  assert.equal(extractSessionToken("nexora_session=%E0%A4%A"), null);
  assert.equal(extractSessionToken("nexora_session=%"), null);
});

test("SessionGuard enforces authentication policy and honors @Public decorator (I1)", async () => {
  const port = createMockIdentityPort();
  const auth = new AuthService(port);

  // Guard for protected route (isPublic = false)
  const protectedGuard = new SessionGuard(auth, createMockReflector(false));

  // Missing cookie on protected route -> 401
  const reqNoCookie = { headers: {} };
  await assert.rejects(
    protectedGuard.canActivate({
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({ getRequest: () => reqNoCookie }),
    }),
    (err) => err.getStatus() === 401,
  );

  // Guard for public route (isPublic = true) -> passes without cookie
  const publicGuard = new SessionGuard(auth, createMockReflector(true));
  const publicResult = await publicGuard.canActivate({
    getHandler: () => {},
    getClass: () => {},
    switchToHttp: () => ({ getRequest: () => reqNoCookie }),
  });
  assert.equal(publicResult, true);

  // Protected route with valid session cookie -> attaches user and passes
  port.users.set("validuser", {
    id: "u-valid",
    username: "validuser",
    passwordHash: "mock-hash-p",
    isActive: true,
  });
  const loginRes = await auth.login("validuser", "p", "127.0.0.1");

  const reqWithCookie = {
    headers: { cookie: `nexora_session=${loginRes.token}` },
  };
  const canActivate = await protectedGuard.canActivate({
    getHandler: () => {},
    getClass: () => {},
    switchToHttp: () => ({ getRequest: () => reqWithCookie }),
  });
  assert.equal(canActivate, true);
  assert.equal(reqWithCookie.user.username, "validuser");
});

test("OriginGuard enforces browser origin validation for mutations (I3)", () => {
  const guard = new OriginGuard();

  // Permitted origins
  assert.equal(isAllowedOrigin("http://localhost:3000"), false);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3001"), true);
  assert.equal(isAllowedOrigin("http://localhost:4000"), false);

  // Disallowed origins
  assert.equal(isAllowedOrigin("http://evil.example"), false);
  assert.equal(isAllowedOrigin("https://malicious.com"), false);
  assert.equal(isAllowedOrigin(""), false);
  assert.equal(isAllowedOrigin(undefined), false);
  assert.equal(isAllowedOrigin("not-a-url"), false);

  // Missing origin -> 403
  assert.throws(
    () =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      }),
    (err) => err.getStatus() === 403,
  );

  // Untrusted origin -> 403
  assert.throws(
    () =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { origin: "http://attacker.example" },
          }),
        }),
      }),
    (err) => err.getStatus() === 403,
  );

  // Allowed origin -> passes
  const allowed = guard.canActivate({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: { origin: "http://127.0.0.1:3001" },
      }),
    }),
  });
  assert.equal(allowed, true);
});

test("Origin rejects other localhost ports and non-serialized values", () => {
  for (const origin of [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:9999",
    "https://localhost:3001",
    "http://localhost:3001/",
    "http://localhost:3001/path",
    "http://localhost:3001?x=1",
    "http://localhost:3001#x",
    "http://user@localhost:3001",
    "http://localhost:3001 http://127.0.0.1:3001",
    "null",
    " http://localhost:3001",
  ])
    assert.equal(isAllowedOrigin(origin), false);
});

test("Origin follows a changed WEB_PORT binding and explicit replacements", () => {
  const oldPort = process.env.WEB_PORT;
  const oldOrigins = process.env.ALLOWED_ORIGINS;
  try {
    process.env.WEB_PORT = "127.0.0.1:3101";
    delete process.env.ALLOWED_ORIGINS;
    assert.equal(isAllowedOrigin("http://127.0.0.1:3101"), true);
    assert.equal(isAllowedOrigin("http://localhost:3001"), false);
    process.env.ALLOWED_ORIGINS = "https://localhost:3101";
    assert.equal(isAllowedOrigin("https://localhost:3101"), true);
    assert.equal(isAllowedOrigin("http://localhost:3101"), false);
  } finally {
    if (oldPort === undefined) delete process.env.WEB_PORT;
    else process.env.WEB_PORT = oldPort;
    if (oldOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = oldOrigins;
  }
});

test("Login rejects invalid credential types and limits before querying", async () => {
  const port = createMockIdentityPort();
  let queries = 0;
  port.findUserByUsername = async () => {
    queries++;
    return null;
  };
  const auth = new AuthService(port);
  for (const value of [
    undefined,
    null,
    123,
    true,
    {},
    [],
    "",
    " ",
    "ab",
    "a".repeat(51),
  ]) {
    await assert.rejects(
      auth.login(value, "password"),
      (e) => e.getStatus?.() === 400,
    );
  }
  for (const value of [
    undefined,
    null,
    123,
    true,
    {},
    [],
    "",
    "a".repeat(1025),
  ]) {
    await assert.rejects(
      auth.login("operator", value),
      (e) => e.getStatus?.() === 400,
    );
  }
  assert.equal(queries, 0);
});

test("Login keeps case-sensitive identity and independent failure counters", async () => {
  const port = createMockIdentityPort();
  for (const username of ["Admin", "admin"])
    port.users.set(username, {
      id: username,
      username,
      isActive: true,
      passwordHash: "mock-hash-correct",
    });
  const auth = new AuthService(port);
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      auth.login("Admin", "wrong"),
      (e) => e.getStatus() === 401,
    );
  const result = await auth.login("admin", "correct");
  assert.equal(result.user.username, "admin");
  await assert.rejects(
    auth.login("Admin", "correct"),
    (e) => e.getStatus() === 429,
  );
});

test("Controller propagates logout failure without clearing cookie", async () => {
  const {
    AuthController,
  } = require("../dist/identity/presentation/auth.controller");
  const controller = new AuthController({
    logout: async () => {
      throw new Error("database unavailable");
    },
  });
  let cleared = false;
  await assert.rejects(
    controller.logout(
      { headers: { cookie: "nexora_session=" + "a".repeat(64) } },
      {
        cookie() {
          cleared = true;
        },
      },
    ),
  );
  assert.equal(cleared, false);
});

test("Canonical HTTP session cookie ignores forged forwarding security", async () => {
  const {
    AuthController,
  } = require("../dist/identity/presentation/auth.controller");
  const controller = new AuthController({
    login: async () => ({
      user: { id: "u", username: "operator" },
      token: "a".repeat(64),
    }),
    logout: async () => {},
  });
  const request = {
    ip: "127.0.0.1",
    socket: {},
    secure: true,
    headers: { "x-forwarded-proto": "https" },
  };
  const cookies = [];
  const response = {
    cookie(name, value, options) {
      cookies.push({ name, value, options });
    },
  };
  await controller.login(
    { username: "operator", password: "password" },
    response,
  );
  await controller.logout(request, response);
  for (const cookie of cookies) {
    assert.equal(cookie.name, "nexora_session");
    assert.equal(cookie.options.secure, false);
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, "lax");
    assert.equal(cookie.options.path, "/");
  }
  assert.equal(cookies[0].options.maxAge, 7 * 24 * 60 * 60 * 1000);
  assert.equal(cookies[1].options.maxAge, 0);
});
