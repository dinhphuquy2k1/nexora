const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../dist/identity/application/auth.service");
const {
  SessionGuard,
  extractSessionToken,
} = require("../dist/identity/presentation/session.guard");

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
      // Simple mock comparator for test
      return password === passwordHash.replace("mock-hash-", "");
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

test("AuthService rate limits consecutive failed login attempts", async () => {
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

test("SessionGuard parses cookies and blocks unauthorized requests", async () => {
  assert.equal(extractSessionToken(undefined), null);
  assert.equal(extractSessionToken("foo=bar; other=1"), null);
  assert.equal(
    extractSessionToken("foo=bar; nexora_session=abc123token; other=1"),
    "abc123token",
  );

  const port = createMockIdentityPort();
  const auth = new AuthService(port);
  const guard = new SessionGuard(auth);

  // Missing cookie
  const reqNoCookie = { headers: {} };
  await assert.rejects(
    guard.canActivate({
      switchToHttp: () => ({ getRequest: () => reqNoCookie }),
    }),
    (err) => err.getStatus() === 401,
  );

  // Valid cookie
  port.users.set("validuser", {
    id: "u-valid",
    username: "validuser",
    passwordHash: "mock-hash-p",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const loginRes = await auth.login("validuser", "p", "127.0.0.1");

  const reqWithCookie = {
    headers: { cookie: `nexora_session=${loginRes.token}` },
  };
  const canActivate = await guard.canActivate({
    switchToHttp: () => ({ getRequest: () => reqWithCookie }),
  });
  assert.equal(canActivate, true);
  assert.equal(reqWithCookie.user.username, "validuser");
});
