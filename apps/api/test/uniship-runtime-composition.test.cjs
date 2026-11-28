const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const {
  UnishipSyncRuntime,
} = require("../dist/sync/infrastructure/uniship-sync.runtime");
const owner = "00000000-0000-4000-8000-000000000001";
const policy = JSON.stringify({
  ownerUserId: owner,
  externalAccountId: "123",
  loginIdentifier: "synthetic",
  mode: "MANUAL_ONLY",
});
const key = randomBytes(32).toString("base64");
const valid = {
  NODE_ENV: "test",
  SYNC_ENABLED: "true",
  UNISHIP_API_URL: "http://127.0.0.1:9",
  UNISHIP_ACTIVATION_POLICY_JSON: policy,
  CARRIER_KEYRING_JSON: JSON.stringify({ 1: key }),
  CARRIER_ACTIVE_KEY_VERSION: "1",
};
function runtime(mode, env) {
  return new UnishipSyncRuntime(
    `postgresql://${mode === "worker" ? "nexora_sync" : "nexora_app"}:unused@127.0.0.1/unused`,
    env,
    mode,
  );
}
test("shared API/Worker declaration has exact FULL/100/processor1/reconciliation1 contract in authorized mock runtime", async () => {
  const a = runtime("api", valid),
    w = runtime("worker", valid);
  try {
    for (const r of [a, w]) {
      const cap = r.capabilities.resolve("uniship", "SHIPMENT");
      assert.ok(cap);
      assert.equal(cap.strategy, "FULL");
      assert.equal(cap.fullScan.pageSize, 100);
      assert.equal(cap.fullScan.sourceKeyScheme, "uniship-parcel-v1");
      assert.equal(cap.processor.version, 1);
      assert.equal(cap.domain.finalizationVersion, 1);
      assert.equal(r.capabilities.resolve("uniship", "CUSTOMER"), null);
      assert.equal(r.capabilities.resolve("other", "SHIPMENT"), null);
    }
  } finally {
    await Promise.all([a.onApplicationShutdown(), w.onApplicationShutdown()]);
  }
});
test("global OFF, missing scope or Carrier key and all unverified external/production targets remain unavailable", async () => {
  for (const env of [
    {},
    { ...valid, SYNC_ENABLED: "false" },
    { ...valid, UNISHIP_ACTIVATION_POLICY_JSON: "" },
    { ...valid, CARRIER_KEYRING_JSON: "" },
    { ...valid, NODE_ENV: "production" },
    {
      ...valid,
      NODE_ENV: "production",
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "true",
    },
    {
      ...valid,
      UNISHIP_API_URL: "https://other.invalid",
      UNISHIP_LIVE_AUTHORIZED: "true",
    },
  ]) {
    const r = runtime("worker", env);
    try {
      assert.equal(r.capabilities.resolve("uniship", "SHIPMENT"), null);
    } finally {
      await r.onApplicationShutdown();
    }
  }
  assert.throws(
    () =>
      new UnishipSyncRuntime(
        "postgresql://postgres:unused@127.0.0.1/unused",
        valid,
        "worker",
      ),
    /custody/i,
  );
});

test("shared API/Worker transport receives parsed activation presence independently of Sync enablement", async (t) => {
  const transport = require("../dist/carrier/infrastructure/uniship/uniship-http.client");
  const Original = transport.UnishipHttpClient;
  const seen = [];
  t.mock.method(transport, "UnishipHttpClient", function (options) {
    seen.push(options.activationConfigured);
    return new Original(options);
  });
  for (const mode of ["api", "worker"])
    for (const configured of [false, true])
      for (const enabled of [false, true]) {
        const r = runtime(mode, {
          ...valid,
          SYNC_ENABLED: String(enabled),
          UNISHIP_ACTIVATION_POLICY_JSON: configured ? policy : "",
        });
        try {
          assert.equal(seen.at(-1), configured);
          assert.equal(r.carrier.client.operationallyAvailable(), true);
          assert.equal(
            Boolean(r.capabilities.resolve("uniship", "SHIPMENT")),
            configured && enabled,
          );
        } finally {
          await r.onApplicationShutdown();
        }
      }
});

test("external or production-loopback composition never dispatches Carrier connect without operational permission", async (t) => {
  let dispatches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    dispatches++;
    throw Error("Unexpected network dispatch");
  });
  for (const mode of ["api", "worker"])
    for (const activation of ["", policy]) {
      const r = runtime(mode, {
        ...valid,
        NODE_ENV: "production",
        SYNC_ENABLED: "false",
        UNISHIP_API_URL: "https://kh.uniship.vn",
        UNISHIP_LIVE_AUTHORIZED: "true",
        UNISHIP_ACTIVATION_POLICY_JSON: activation,
      });
      r.carrier.store.authorizeNew = async () => 0;
      r.carrier.audit.append = async () => {};
      r.carrier.store.create = async () =>
        assert.fail("Denied connect persisted");
      try {
        assert.equal(r.carrier.client.operationallyAvailable(), false);
        await assert.rejects(
          r.carrier.lifecycle.connect(owner, {
            loginIdentifier: "synthetic",
            password: "synthetic-password",
            displayName: "Synthetic",
          }),
          { code: "SERVICE_UNAVAILABLE" },
        );
      } finally {
        await r.onApplicationShutdown();
      }
    }
  const productionLoopback = runtime("api", {
    ...valid,
    NODE_ENV: "production",
    UNISHIP_API_URL: "https://127.0.0.1:9",
    UNISHIP_ACTIVATION_POLICY_JSON: "",
  });
  productionLoopback.carrier.store.authorizeNew = async () => 0;
  productionLoopback.carrier.audit.append = async () => {};
  try {
    assert.equal(
      productionLoopback.carrier.client.operationallyAvailable(),
      false,
    );
    assert.throws(
      () => productionLoopback.carrier.context(owner, owner, "synthetic"),
      { code: "SERVICE_UNAVAILABLE" },
    );
  } finally {
    await productionLoopback.onApplicationShutdown();
  }
  assert.equal(dispatches, 0);
});

test("scoped Connect with Sync OFF checks context before provider and verified account before encryption/persistence", async () => {
  for (const fixture of [
    {
      label: "wrong owner",
      login: "synthetic",
      patch: { ownerUserId: "00000000-0000-4000-8000-000000000099" },
      calls: 0,
    },
    { label: "wrong login", login: "other", patch: {}, calls: 0 },
    {
      label: "optional connection",
      login: "synthetic",
      patch: { connectionId: owner },
      calls: 0,
    },
    {
      label: "candidate account",
      login: "synthetic",
      patch: {},
      account: "999",
      calls: 2,
    },
    {
      label: "auth verify identity",
      login: "synthetic",
      patch: {},
      verifyAccount: "999",
      calls: 2,
    },
    {
      label: "approved mock",
      login: "synthetic",
      patch: {},
      calls: 2,
      success: true,
    },
    {
      label: "legacy blank loopback",
      login: "synthetic",
      blank: true,
      calls: 2,
      success: true,
    },
  ]) {
    const r = runtime("api", {
      ...valid,
      SYNC_ENABLED: "false",
      UNISHIP_ACTIVATION_POLICY_JSON: fixture.blank
        ? ""
        : JSON.stringify({ ...JSON.parse(policy), ...fixture.patch }),
    });
    let calls = 0,
      writes = 0,
      encryptions = 0;
    r.carrier.store.authorizeNew = async () => 0;
    r.carrier.store.create = async () => {
      writes++;
      return { status: "CONNECTED" };
    };
    r.carrier.audit.append = async () => {};
    // Unit boundary: scoped provider callbacks are real; PostgreSQL budgets are covered by signed fixtures.
    r.carrier.budget.run = async (operation) => operation();
    const cipher = r.carrier.lifecycle.credentials.cipher;
    const encrypt = cipher.encrypt.bind(cipher);
    cipher.encrypt = (...args) => {
      encryptions++;
      return encrypt(...args);
    };
    r.carrier.client.authenticate = async () => {
      calls++;
      return {
        externalAccountId: fixture.account ?? "123",
        candidateToken: "synthetic-token",
      };
    };
    r.carrier.client.verify = async () => {
      calls++;
      return {
        externalAccountId: fixture.verifyAccount ?? fixture.account ?? "123",
        candidateToken: "synthetic-token",
      };
    };
    try {
      const operation = r.carrier.lifecycle.connect(owner, {
        loginIdentifier: fixture.login,
        password: "synthetic-password",
        displayName: "Synthetic",
      });
      if (fixture.success) assert.equal((await operation).status, "CONNECTED");
      else
        await assert.rejects(operation, {
          code: fixture.calls
            ? "CANDIDATE_IDENTITY_MISMATCH"
            : "SERVICE_UNAVAILABLE",
        });
      assert.equal(calls, fixture.calls, fixture.label);
      assert.equal(writes, fixture.success ? 1 : 0, fixture.label);
      assert.equal(encryptions, fixture.success ? 2 : 0, fixture.label);
      assert.equal(r.capabilities.resolve("uniship", "SHIPMENT"), null);
    } finally {
      await r.onApplicationShutdown();
    }
  }
});

test("malformed activation fails closed in shared construction without network", (t) => {
  let dispatches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    dispatches++;
    throw Error("Unexpected fetch");
  });
  for (const mode of ["api", "worker"])
    for (const raw of [
      "{",
      "null",
      JSON.stringify({ ...JSON.parse(policy), externalAccountId: 123 }),
    ])
      assert.throws(
        () => runtime(mode, { ...valid, UNISHIP_ACTIVATION_POLICY_JSON: raw }),
        /configuration/i,
      );
  assert.equal(dispatches, 0);
});
