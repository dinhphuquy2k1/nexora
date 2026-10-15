const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../dist/identity/application/auth.service");
for (const role of ["ADMIN", "OPERATOR"])
  test(`${role} local login uses atomic verified-hash issuance`, async () => {
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
    const result = await new AuthService(port).login("person", "password");
    assert.equal(result.user.id, "u");
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
    new AuthService(port).login("person", "password"),
    (e) => e.getStatus() === 401,
  );
});
