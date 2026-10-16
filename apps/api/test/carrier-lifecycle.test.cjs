const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CarrierConnectionLifecycleService,
} = require("../dist/carrier/application/carrier-connection-lifecycle.service");
const {
  LifecycleCode,
  LifecycleFailure,
} = require("../dist/carrier/domain/lifecycle");
const { ConnectionStatus } = require("../dist/carrier/domain/carrier");
const { CryptoFailure } = require("../dist/common/crypto/secret-cipher");
function fixture(expired = true) {
  let version = 0,
    status = ConnectionStatus.CONNECTED,
    acquisitions = 0,
    writes = 0,
    fails = 0;
  let expiry = expired ? new Date(0) : null;
  const snapshot = () => ({
    connection: {
      id: "connection",
      loginIdentifier: "synthetic",
      externalAccountId: "1",
      status,
    },
    generation: 0,
    version,
    hasToken: true,
    expiresAt: expiry,
  });
  const store = {
    read: async () => snapshot(),
    authorizeNew: async () => 0,
    claim: async (_user, _id, expected) => {
      if (expected !== undefined && version !== expected)
        throw new LifecycleFailure(LifecycleCode.STALE);
      version++;
      return snapshot();
    },
    complete: async (_user, claim) => {
      if (claim.version !== version)
        throw new LifecycleFailure(LifecycleCode.STALE);
      writes++;
      version++;
      status = ConnectionStatus.CONNECTED;
      expiry = null;
      return snapshot().connection;
    },
    fail: async (_user, claim, next) => {
      if (claim.version === version) {
        fails++;
        status = next;
        version++;
      }
    },
  };
  const credentials = {
    acquireStored: async () => {
      acquisitions++;
      return { externalAccountId: "1" };
    },
    acquireNew: async () => ({ externalAccountId: "1" }),
    useToken: async (_user, _snapshot, operation) =>
      operation("synthetic-token"),
  };
  const service = new CarrierConnectionLifecycleService(
    store,
    credentials,
    {
      admit() {},
    },
    { append: async () => {} },
  );
  return {
    service,
    store,
    credentials,
    snapshot,
    counts: () => ({ acquisitions, writes, fails }),
    state: (next) => {
      status = next;
    },
  };
}
test("lazy expiry recovers once across simultaneous real operations without caching plaintext", async () => {
  const f = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const acquire = f.credentials.acquireStored;
  f.credentials.acquireStored = async (...args) => {
    await gate;
    return acquire(...args);
  };
  const pending = Array.from({ length: 20 }, () =>
    f.service.withToken("owner", "connection", async (token) => {
      assert.equal(token, "synthetic-token");
      return "result";
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  assert.deepEqual(await Promise.all(pending), Array(20).fill("result"));
  assert.deepEqual(f.counts(), { acquisitions: 1, writes: 1, fails: 0 });
  assert.equal(f.service.recoveries.size, 0);
});
test("unknown expiry uses token directly; provider rejection causes at most one recovery", async () => {
  const f = fixture(false);
  assert.equal(
    await f.service.withToken("owner", "connection", async () => 42),
    42,
  );
  assert.equal(f.counts().acquisitions, 0);
  let operations = 0;
  await assert.rejects(
    f.service.withToken("owner", "connection", async () => {
      operations++;
      throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
    }),
    { code: LifecycleCode.TOKEN_REJECTED },
  );
  assert.equal(operations, 2);
  assert.equal(f.counts().acquisitions, 1);
});
test("identity mismatch requires manual reconnect; crypto failure leaves status untouched", async () => {
  const f = fixture();
  f.credentials.acquireStored = async () => ({ externalAccountId: "other" });
  await assert.rejects(
    f.service.withToken("owner", "connection", async () => {}),
    { code: LifecycleCode.IDENTITY_MISMATCH },
  );
  assert.equal(
    f.snapshot().connection.status,
    ConnectionStatus.REAUTH_REQUIRED,
  );
  await assert.rejects(
    f.service.withToken("owner", "connection", async () => {}),
    { code: LifecycleCode.REAUTH_REQUIRED },
  );
  const g = fixture();
  g.credentials.acquireStored = async () => {
    throw new CryptoFailure();
  };
  await assert.rejects(
    g.service.withToken("owner", "connection", async () => {}),
    CryptoFailure,
  );
  assert.equal(g.snapshot().connection.status, ConnectionStatus.CONNECTED);
  assert.equal(g.counts().fails, 0);
});
test("older manual reconnect completion/failure cannot overwrite newer manual success", async () => {
  const f = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  f.credentials.acquireNew = async (_user, _id, _login, password) => {
    if (password === "old") await gate;
    return { externalAccountId: "1" };
  };
  const old = f.service.reconnect("owner", "connection", "old");
  const rejected = assert.rejects(old, { code: LifecycleCode.STALE });
  await new Promise((resolve) => setTimeout(resolve, 0));
  await f.service.reconnect("owner", "connection", "new");
  release();
  await rejected;
  assert.deepEqual(f.counts(), { acquisitions: 0, writes: 1, fails: 0 });
  assert.equal(f.snapshot().connection.status, ConnectionStatus.CONNECTED);
});

test("failed manual reconnect cannot clear an existing manual reauthentication requirement", async () => {
  const f = fixture();
  f.state(ConnectionStatus.REAUTH_REQUIRED);
  f.credentials.acquireNew = async () => {
    throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
  };
  await assert.rejects(
    f.service.reconnect("owner", "connection", "synthetic"),
    { code: LifecycleCode.SERVICE_UNAVAILABLE },
  );
  assert.equal(
    f.snapshot().connection.status,
    ConnectionStatus.REAUTH_REQUIRED,
  );
  await assert.rejects(
    f.service.withToken("owner", "connection", async () => {}),
    { code: LifecycleCode.REAUTH_REQUIRED },
  );
});
