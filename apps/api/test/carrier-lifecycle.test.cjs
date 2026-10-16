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
    tokenRevision: `sealed-${writes}`,
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

for (const status of Object.values(ConnectionStatus)) {
  for (const code of [
    LifecycleCode.PROVIDER_AUTH_FAILED,
    LifecycleCode.TOKEN_REJECTED,
    LifecycleCode.SERVICE_UNAVAILABLE,
    LifecycleCode.RATE_LIMITED,
    LifecycleCode.CANDIDATE_IDENTITY_MISMATCH,
  ]) {
    test(`manual ${code} preserves ${status}, records failure audit and never acquires stored password`, async () => {
      const f = fixture(false);
      f.state(status);
      const events = [];
      f.service.audit.append = async (e) => events.push(e);
      f.credentials.acquireNew = async () => {
        throw new LifecycleFailure(code);
      };
      await assert.rejects(
        f.service.reconnect("owner", "connection", "wrong"),
        { code },
      );
      assert.equal(f.snapshot().connection.status, status);
      assert.equal(f.counts().fails, 0);
      assert.equal(f.counts().acquisitions, 0);
      assert.equal(events.length, 1);
      assert.equal(events[0].eventType, "RECONNECT");
      assert.equal(events[0].outcome, "FAILURE");
      if (status === ConnectionStatus.CONNECTED)
        assert.equal(
          await f.service.withToken(
            "owner",
            "connection",
            async (token) => token,
          ),
          "synthetic-token",
        );
    });
  }
}
test("manual verified stored identity mismatch alone requires reauthentication", async () => {
  const f = fixture(false);
  f.credentials.acquireNew = async () => ({ externalAccountId: "other" });
  await assert.rejects(f.service.reconnect("owner", "connection", "new"), {
    code: LifecycleCode.IDENTITY_MISMATCH,
  });
  assert.equal(
    f.snapshot().connection.status,
    ConnectionStatus.REAUTH_REQUIRED,
  );
});
for (const [code, status] of [
  [LifecycleCode.PROVIDER_AUTH_FAILED, ConnectionStatus.REAUTH_REQUIRED],
  [LifecycleCode.TOKEN_REJECTED, ConnectionStatus.REAUTH_REQUIRED],
  [LifecycleCode.CANDIDATE_IDENTITY_MISMATCH, ConnectionStatus.REAUTH_REQUIRED],
  [LifecycleCode.SERVICE_UNAVAILABLE, ConnectionStatus.ERROR],
  [LifecycleCode.RATE_LIMITED, ConnectionStatus.ERROR],
]) {
  test(`recovery ${code} retains fail-closed ${status} policy`, async () => {
    const f = fixture();
    f.credentials.acquireStored = async () => {
      throw new LifecycleFailure(code);
    };
    await assert.rejects(
      f.service.withToken("owner", "connection", async () => {}),
      { code },
    );
    assert.equal(f.snapshot().connection.status, status);
  });
}
test("late failed manual candidate cannot overwrite a newer success", async () => {
  const f = fixture(false);
  let release;
  const gate = new Promise((r) => (release = r));
  f.credentials.acquireNew = async (_u, _id, _name, password) => {
    if (password === "old") {
      await gate;
      throw new LifecycleFailure(LifecycleCode.IDENTITY_MISMATCH);
    }
    return { externalAccountId: "1" };
  };
  const older = assert.rejects(
    f.service.reconnect("owner", "connection", "old"),
    { code: LifecycleCode.IDENTITY_MISMATCH },
  );
  await new Promise((r) => setTimeout(r, 0));
  await f.service.reconnect("owner", "connection", "new");
  release();
  await older;
  assert.equal(f.snapshot().connection.status, ConnectionStatus.CONNECTED);
  assert.equal(f.counts().fails, 0);
  assert.equal(f.counts().writes, 1);
});

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
function pauseRecovery(f) {
  const started = deferred(),
    release = deferred();
  const original = f.service.performRecovery.bind(f.service);
  let calls = 0;
  f.service.performRecovery = async (...args) => {
    if (++calls === 1) {
      started.resolve();
      await release.promise;
    }
    return original(...args);
  };
  return {
    started: started.promise,
    release: release.resolve,
    calls: () => calls,
  };
}
for (const count of [1, 20])
  test(`expired token / failed manual claim still audited-recovers once for ${count} callers`, async () => {
    const f = fixture(),
      barrier = pauseRecovery(f);
    let operations = 0;
    f.credentials.acquireNew = async () => {
      throw new LifecycleFailure(LifecycleCode.PROVIDER_AUTH_FAILED);
    };
    f.credentials.useToken = async (_u, _s, op) =>
      op(f.counts().writes ? "fresh" : "expired");
    const pending = Array.from({ length: count }, () =>
      f.service.withToken("owner", "connection", async (token) => {
        operations++;
        assert.equal(token, "fresh");
        return true;
      }),
    );
    await barrier.started;
    const before = f.snapshot();
    await assert.rejects(f.service.reconnect("owner", "connection", "wrong"), {
      code: LifecycleCode.PROVIDER_AUTH_FAILED,
    });
    assert.equal(f.snapshot().tokenRevision, before.tokenRevision);
    assert.ok(f.snapshot().version > before.version);
    assert.equal(f.snapshot().connection.status, ConnectionStatus.CONNECTED);
    barrier.release();
    assert.deepEqual(await Promise.all(pending), Array(count).fill(true));
    assert.equal(f.counts().acquisitions, 1);
    assert.equal(f.counts().writes, 1);
    assert.equal(operations, count);
    assert.equal(f.service.recoveries.size, 0);
  });
test("unknown expiry rejected token is not reused after failed manual claim", async () => {
  const f = fixture(false);
  let operations = 0;
  f.credentials.acquireNew = async () => {
    throw new LifecycleFailure(LifecycleCode.PROVIDER_AUTH_FAILED);
  };
  f.credentials.useToken = async (_u, _s, op) =>
    op(f.counts().writes ? "fresh" : "rejected");
  assert.equal(
    await f.service.withToken("owner", "connection", async (token) => {
      operations++;
      if (operations === 1) {
        assert.equal(token, "rejected");
        await assert.rejects(
          f.service.reconnect("owner", "connection", "wrong"),
        );
        throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
      }
      assert.equal(token, "fresh");
      return true;
    }),
    true,
  );
  assert.equal(operations, 2);
  assert.equal(f.counts().acquisitions, 1);
  assert.equal(f.service.recoveries.size, 0);
});
for (const expired of [true, false])
  test(`successful concurrent manual replacement reused without password recovery (expired=${expired})`, async () => {
    const f = fixture(expired);
    let operations = 0;
    f.credentials.useToken = async (_u, _s, op) =>
      op(f.counts().writes ? "manual-new" : "old");
    if (expired) {
      const barrier = pauseRecovery(f);
      const pending = f.service.withToken(
        "owner",
        "connection",
        async (token) => {
          operations++;
          assert.equal(token, "manual-new");
          return true;
        },
      );
      await barrier.started;
      await f.service.reconnect("owner", "connection", "new");
      barrier.release();
      assert.equal(await pending, true);
    } else
      assert.equal(
        await f.service.withToken("owner", "connection", async (token) => {
          operations++;
          if (operations === 1) {
            await f.service.reconnect("owner", "connection", "new");
            throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
          }
          assert.equal(token, "manual-new");
          return true;
        }),
        true,
      );
    assert.equal(f.counts().acquisitions, 0);
    assert.equal(f.counts().writes, 1);
    assert.equal(f.service.recoveries.size, 0);
  });
test(
  "repeated version-only supersession has explicit three-decision bound",
  { timeout: 2000 },
  async () => {
    const f = fixture();
    const original = f.service.performRecovery.bind(f.service);
    let decisions = 0,
      operations = 0;
    f.credentials.acquireNew = async () => {
      throw new LifecycleFailure(LifecycleCode.PROVIDER_AUTH_FAILED);
    };
    f.service.performRecovery = async (...args) => {
      if (++decisions > 5) throw Error("UNBOUNDED_RECOVERY");
      await assert.rejects(f.service.reconnect("owner", "connection", "wrong"));
      return original(...args);
    };
    await assert.rejects(
      f.service.withToken("owner", "connection", async () => {
        operations++;
        throw new LifecycleFailure(LifecycleCode.TOKEN_REJECTED);
      }),
      { code: LifecycleCode.STALE },
    );
    assert.ok(decisions <= 3);
    assert.equal(f.counts().acquisitions, 0);
    assert.equal(operations, 0);
    assert.equal(f.service.recoveries.size, 0);
  },
);
for (const code of [
  LifecycleCode.NOT_FOUND,
  LifecycleCode.UNAUTHORIZED,
  LifecycleCode.REAUTH_REQUIRED,
])
  test(`revoked recovery waiter fails closed: ${code}`, async () => {
    const f = fixture(),
      barrier = pauseRecovery(f);
    let operations = 0;
    const result = assert.rejects(
      f.service.withToken("owner", "connection", async () => operations++),
      { code },
    );
    await barrier.started;
    if (code === LifecycleCode.REAUTH_REQUIRED)
      f.state(ConnectionStatus.REAUTH_REQUIRED);
    else
      f.store.read = async () => {
        throw new LifecycleFailure(code);
      };
    barrier.release();
    await result;
    assert.equal(f.counts().acquisitions, 0);
    assert.equal(operations, 0);
    assert.equal(f.service.recoveries.size, 0);
  });
test("singleflight failure fans out once and cleans up without a login storm", async () => {
  const f = fixture(),
    started = deferred(),
    release = deferred();
  let attempts = 0;
  f.credentials.acquireStored = async () => {
    attempts++;
    started.resolve();
    await release.promise;
    throw new LifecycleFailure(LifecycleCode.PROVIDER_AUTH_FAILED);
  };
  const pending = Array.from({ length: 20 }, () =>
    assert.rejects(
      f.service.withToken("owner", "connection", async () => {}),
      { code: LifecycleCode.PROVIDER_AUTH_FAILED },
    ),
  );
  await started.promise;
  release.resolve();
  await Promise.all(pending);
  assert.equal(attempts, 1);
  assert.equal(f.service.recoveries.size, 0);
});

test("claim CAS supersession before vault entry preserves the password attempt budget", async () => {
  const f = fixture(),
    claim = f.store.claim;
  let raced = false;
  f.credentials.acquireNew = async () => {
    throw new LifecycleFailure(LifecycleCode.PROVIDER_AUTH_FAILED);
  };
  f.store.claim = async (...args) => {
    if (args[2] !== undefined && !raced) {
      raced = true;
      await assert.rejects(f.service.reconnect("owner", "connection", "wrong"));
    }
    return claim(...args);
  };
  assert.equal(
    await f.service.withToken("owner", "connection", async () => true),
    true,
  );
  assert.equal(f.counts().acquisitions, 1);
  assert.equal(f.service.recoveries.size, 0);
});
test("supersession after vault entry cannot spend a second password attempt", async () => {
  const f = fixture(),
    acquire = f.credentials.acquireStored;
  f.credentials.acquireNew = async () => {
    throw new LifecycleFailure(LifecycleCode.PROVIDER_AUTH_FAILED);
  };
  f.credentials.acquireStored = async (...args) => {
    const candidate = await acquire(...args);
    await assert.rejects(f.service.reconnect("owner", "connection", "wrong"));
    return candidate;
  };
  await assert.rejects(
    f.service.withToken("owner", "connection", async () => {
      throw Error("UNUSABLE_TOKEN");
    }),
    { code: LifecycleCode.STALE },
  );
  assert.equal(f.counts().acquisitions, 1);
  assert.equal(f.counts().writes, 0);
  assert.equal(f.service.recoveries.size, 0);
});
