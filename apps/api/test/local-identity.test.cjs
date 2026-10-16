const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../dist/identity/application/auth.service");
for (const role of ["ADMIN", "OPERATOR"])
  test(`${role} local login uses atomic verified-hash session or challenge issuance`, async () => {
    let issued = 0;
    const port = {
      findUserByUsername: async () => ({
        id: "u",
        username: "person",
        role,
        status: "ACTIVE",
        passwordHash: "verified-hash",
      }),
      verifyPassword: async () => true,
      createSessionIfUnchanged: async (id, hash, token, expires) => {
        assert.equal(id, "u");
        assert.equal(hash, "verified-hash");
        assert.equal(token.length, 64);
        assert.ok(expires > Date.now());
        issued++;
        return { id: "u", username: "person" };
      },
    };
    const mfa = {
      issueChallenge: async (...args) => port.createSessionIfUnchanged(...args),
    };
    const result = await new AuthService(port, Date.now, mfa).login(
      "person",
      "password",
    );
    if (role === "ADMIN") {
      assert.equal(result.mfaRequired, true);
      assert.equal(result.token, undefined);
    } else assert.equal(result.user.id, "u");
    assert.equal(issued, 1);
  });
test("concurrent password/status change refuses session after successful password check", async () => {
  const port = {
    findUserByUsername: async () => ({
      id: "u",
      username: "person",
      role: "ADMIN",
      status: "ACTIVE",
      passwordHash: "old",
    }),
    verifyPassword: async () => true,
    createSessionIfUnchanged: async () => null,
  };
  await assert.rejects(
    new AuthService(port, Date.now, { issueChallenge: async () => null }).login(
      "person",
      "password",
    ),
    (e) => e.getStatus() === 401,
  );
});
