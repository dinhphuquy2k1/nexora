const { test, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const passwords = require("@nexora/database/dist/password");
// Mock only the database factory boundary. This suite never needs a live DB or Prisma engine.
const databasePath = require.resolve("@nexora/database");
const previous = require.cache[databasePath];
let databaseFactory = () => {
  throw new Error("Test must inject database client");
};
require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: {
    ...passwords,
    createDatabase() {
      return databaseFactory();
    },
  },
};
const {
  IdentityDatabaseAdapter,
} = require("../../dist/identity/infrastructure/identity.adapter");
const {
  provisionUser,
} = require("../../dist/identity/infrastructure/user-provisioner");
if (previous) require.cache[databasePath] = previous;
else delete require.cache[databasePath];
const { AuthService } = require("../../dist/identity/application/auth.service");

test("revocation is idempotent deleteMany and propagates database failures", async () => {
  const adapter = new IdentityDatabaseAdapter("unused");
  let deleted;
  adapter.instance = {
    session: {
      deleteMany: async (args) => {
        deleted = args;
        return { count: 0 };
      },
    },
  };
  await adapter.deleteSessionByTokenHash("token-hash");
  assert.deepEqual(deleted, { where: { tokenHash: "token-hash" } });
  adapter.instance.session.deleteMany = async () => {
    throw new Error("test database failure");
  };
  await assert.rejects(
    adapter.deleteSessionByTokenHash("token-hash"),
    /test database failure/,
  );
});

test("unknown and inactive users execute valid real Scrypt dummy verification", async () => {
  const original = crypto.scrypt;
  const spy = mock.method(crypto, "scrypt", (...args) => original(...args));
  try {
    for (const record of [
      null,
      { role: "ADMIN", status: "DISABLED", passwordHash: "unused" },
    ]) {
      let observedHash;
      const adapter = new IdentityDatabaseAdapter("unused");
      const auth = new AuthService({
        findUserByUsername: async () => record,
        verifyPassword: async (password, hash) => {
          observedHash = hash;
          return adapter.verifyPassword(password, hash);
        },
      });
      const before = spy.mock.callCount();
      await assert.rejects(
        auth.login("operator", "nexora-dummy-verification-only"),
        (e) => e.getStatus() === 401,
      );
      assert.equal(spy.mock.callCount(), before + 1);
      assert.equal(
        await passwords.verifyPassword(
          "nexora-dummy-verification-only",
          observedHash,
        ),
        true,
      );
    }
  } finally {
    spy.mock.restore();
  }
});

test("provisioning uses normalized case-sensitive username and real hashing, rejects duplicates", async () => {
  let query;
  let created;
  let disconnected = 0;
  databaseFactory = () => ({
    user: {
      findUnique: async (args) => {
        query = args;
        return null;
      },
      create: async (args) => {
        created = args;
        return {};
      },
    },
    $disconnect: async () => {
      disconnected++;
    },
  });
  await provisionUser("fixture-unused", "  Admin  ", "FixturePassword123!");
  assert.deepEqual(query, { where: { username: "Admin" } });
  assert.equal(created.data.username, "Admin");
  assert.equal(created.data.role, "ADMIN");
  assert.equal(created.data.status, "ACTIVE");
  assert.ok(created.data.credential.create.passwordHash);
  assert.equal(
    await passwords.verifyPassword(
      "FixturePassword123!",
      created.data.credential.create.passwordHash,
    ),
    true,
  );
  assert.equal(disconnected, 1);
  databaseFactory = () => ({
    user: { findUnique: async () => ({ id: "existing" }) },
    $disconnect: async () => {
      disconnected++;
    },
  });
  await assert.rejects(
    provisionUser("fixture-unused", "Admin", "FixturePassword123!"),
    /already exists/,
  );
  assert.equal(disconnected, 2);
  await assert.rejects(
    provisionUser("fixture-unused", 123, "FixturePassword123!"),
  );
  await assert.rejects(provisionUser("fixture-unused", "Admin", "short"));
});

test("generic session adapter accepts ACTIVE Operator without requesting credentials", async () => {
  const adapter = new IdentityDatabaseAdapter("unused");
  let query;
  const record = {
    id: "session",
    userId: "operator",
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date(),
    user: {
      id: "operator",
      username: "operator",
      role: "OPERATOR",
      status: "ACTIVE",
    },
  };
  adapter.instance = {
    session: {
      findUnique: async (args) => {
        query = args;
        return record;
      },
    },
  };
  assert.deepEqual((await adapter.findSessionByTokenHash("hash")).user, {
    id: "operator",
    username: "operator",
  });
  assert.deepEqual(query, {
    where: { tokenHash: "hash" },
    include: { user: true },
  });
  record.user.status = "DISABLED";
  assert.equal(await adapter.findSessionByTokenHash("hash"), null);
});
