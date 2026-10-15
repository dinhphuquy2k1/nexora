const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  UserManagementService,
} = require("../dist/identity/application/user-management.service");
const { AuthService } = require("../dist/identity/application/auth.service");
test("onboarding validates before hashing; admin never supplies operator password; fragment-only link returns no token hash", async () => {
  let hashes = 0,
    stored;
  const service = new UserManagementService(
    {
      hashPassword: async () => {
        hashes++;
        return "hash";
      },
      consume: async () => {},
      createOperator: async (...args) => {
        stored = args;
        return { id: "u", username: "operator" };
      },
    },
    new AuthService({}),
    ["http://localhost:3001"],
  );
  for (const password of ["short", "x".repeat(1025), null, 123])
    await assert.rejects(
      service.setupPassword({ token: "a".repeat(64), password }),
      (e) => e.getStatus() === 400,
    );
  assert.equal(hashes, 0);
  await assert.rejects(
    service.createOperator(
      "admin",
      { username: "person", password: "chosen-by-admin" },
      "http://localhost:3001",
    ),
    (e) => e.getStatus() === 400,
  );
  await assert.rejects(
    service.createOperator(
      "admin",
      { username: "person" },
      "https://attacker.example",
    ),
    (e) => e.getStatus() === 403,
  );
  const result = await service.createOperator(
    "admin",
    { username: "person" },
    "http://localhost:3001",
  );
  const url = new URL(result.setupUrl);
  assert.equal(url.pathname, "/setup");
  assert.equal(url.search, "");
  assert.match(url.hash, /^#token=[a-f0-9]{64}$/);
  assert.notEqual(stored[2], url.hash.slice(7));
  assert.equal(stored[2].length, 64);
  assert.ok(result.expiresAt > Date.now() + 23 * 3600000);
  assert.equal(JSON.stringify(result).includes(stored[2]), false);
  await service.setupPassword({
    token: "b".repeat(64),
    password: "ValidPassword123!",
  });
  assert.equal(hashes, 1);
});
