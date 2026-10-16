require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../dist/identity/application/auth.service");
const { MfaService } = require("../dist/identity/application/mfa.service");
const { AdminGuard } = require("../dist/identity/presentation/admin.guard");
const user = {
  id: "admin-id",
  username: "admin",
  role: "ADMIN",
  status: "ACTIVE",
  passwordHash: "verified",
};
function fixture() {
  let sessions = 0,
    challenges = 0;
  const port = {
    findUserByUsername: async () => user,
    verifyPassword: async () => true,
    createSessionIfUnchanged: async () => {
      sessions++;
      return user;
    },
  };
  const mfa = {
    issueChallenge: async () => {
      challenges++;
      return { id: user.id, username: user.username };
    },
    challengeOwner: async () => user.id,
    verify: async () => ({ id: user.id, username: user.username }),
    cancel: async () => {},
  };
  return { port, mfa, counts: () => ({ sessions, challenges }) };
}
test("ADMIN password creates only pending challenge; unenrolled never receives session", async () => {
  const f = fixture(),
    auth = new AuthService(f.port, Date.now, f.mfa),
    result = await auth.login("admin", "password");
  assert.equal(result.mfaRequired, true);
  assert.equal(result.token, undefined);
  assert.match(result.challengeToken, /^[a-f0-9]{64}$/);
  assert.deepEqual(f.counts(), { sessions: 0, challenges: 1 });
  f.mfa.issueChallenge = async () => "NOT_ENROLLED";
  await assert.rejects(
    auth.login("admin", "password"),
    (e) =>
      e.getStatus() === 403 &&
      e.getResponse().code === "MFA_ENROLLMENT_REQUIRED",
  );
  assert.equal(f.counts().sessions, 0);
});
test("MFA strict body/cookie validation and account admission; no client assurance", async () => {
  const f = fixture(),
    auth = new AuthService(f.port),
    service = new MfaService(f.mfa, auth);
  const token = "a".repeat(64);
  for (const body of [
    { type: "totp", code: 123456 },
    { type: "totp", code: "123456", token },
    { type: "unknown", code: "123456" },
    { type: "totp", code: "１２３４５６" },
  ])
    await assert.rejects(
      service.verify(token, body),
      (e) => e.getStatus() === 400,
    );
  await assert.rejects(
    service.verify("bad", { type: "totp", code: "123456" }),
    (e) => e.getStatus() === 401,
  );
  f.mfa.verify = async () => null;
  for (let i = 0; i < 5; i++)
    await assert.rejects(
      service.verify(token, { type: "totp", code: "123456" }),
      (e) => e.getStatus() === 401,
    );
  await assert.rejects(
    service.verify(token, { type: "totp", code: "123456" }),
    (e) => e.getStatus() === 429,
  );
});
test("AdminGuard requires DB session MFA even if client supplies MFA", async () => {
  const req = {
    headers: { cookie: "nexora_session=" + "a".repeat(64), auth_level: "MFA" },
    user: { id: user.id },
    authLevel: "MFA",
  };
  let level = "PASSWORD";
  const port = {
    findActiveRole: async () => "ADMIN",
    findSessionByTokenHash: async () => ({
      session: { expiresAt: new Date(Date.now() + 100000), authLevel: level },
      user: { id: user.id },
    }),
  };
  const guard = new AdminGuard(port),
    context = { switchToHttp: () => ({ getRequest: () => req }) };
  await assert.rejects(
    guard.canActivate(context),
    (e) => e.getStatus() === 403,
  );
  level = "MFA";
  assert.equal(await guard.canActivate(context), true);
});
