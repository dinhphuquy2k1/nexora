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
test("global OFF, missing scope or Carrier key, unapproved origins, and live opt-in matrix enforce exact availability", async () => {
  const unavailableCarrierCases = [
    {},
    {
      ...valid,
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "false",
    },
    {
      ...valid,
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "true",
      UNISHIP_ACTIVATION_POLICY_JSON: "",
    },
    {
      ...valid,
      NODE_ENV: "production",
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "true",
      UNISHIP_ACTIVATION_POLICY_JSON: "",
    },
    {
      ...valid,
      UNISHIP_API_URL: "https://other.invalid",
      UNISHIP_LIVE_AUTHORIZED: "true",
    },
    {
      ...valid,
      NODE_ENV: "production",
      UNISHIP_API_URL: "https://127.0.0.1:9",
    },
  ];
  for (const mode of ["api", "worker"]) {
    for (const env of unavailableCarrierCases) {
      const r = runtime(mode, env);
      try {
        assert.equal(r.carrier.client.operationallyAvailable(), false);
        assert.equal(r.capabilities.resolve("uniship", "SHIPMENT"), null);
      } finally {
        await r.onApplicationShutdown();
      }
    }
  }

  for (const [label, envPatch, expectSync] of [
    [
      "approved external Sync OFF",
      {
        UNISHIP_API_URL: "https://kh.uniship.vn",
        UNISHIP_LIVE_AUTHORIZED: "true",
        SYNC_ENABLED: "false",
      },
      false,
    ],
    [
      "approved external Sync ON synthetic",
      {
        UNISHIP_API_URL: "https://kh.uniship.vn",
        UNISHIP_LIVE_AUTHORIZED: "true",
        SYNC_ENABLED: "true",
      },
      true,
    ],
    [
      "approved external Sync ON without key",
      {
        UNISHIP_API_URL: "https://kh.uniship.vn",
        UNISHIP_LIVE_AUTHORIZED: "true",
        SYNC_ENABLED: "true",
        CARRIER_KEYRING_JSON: "",
      },
      false,
    ],
    [
      "nonproduction loopback Sync OFF",
      { UNISHIP_API_URL: "http://127.0.0.1:9", SYNC_ENABLED: "false" },
      false,
    ],
  ]) {
    for (const mode of ["api", "worker"]) {
      const r = runtime(mode, { ...valid, ...envPatch });
      try {
        assert.equal(r.carrier.client.operationallyAvailable(), true, label);
        assert.equal(
          Boolean(r.capabilities.resolve("uniship", "SHIPMENT")),
          expectSync,
          label,
        );
      } finally {
        await r.onApplicationShutdown();
      }
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

test("external composition denies missing policy, disabled opt-in, and production loopback with zero fetch, while valid scoped Sync OFF dispatches mocked external Connect and Reconnect", async (t) => {
  let dispatches = 0;
  let routeHandler = null;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    dispatches++;
    if (!routeHandler) throw Error("Unexpected network dispatch");
    return routeHandler(String(url), init);
  });

  // Missing policy, live flag OFF, unapproved origin, and production loopback stay denied with zero fetch
  for (const mode of ["api", "worker"])
    for (const [label, envPatch] of [
      [
        "missing policy",
        {
          UNISHIP_API_URL: "https://kh.uniship.vn",
          UNISHIP_LIVE_AUTHORIZED: "true",
          UNISHIP_ACTIVATION_POLICY_JSON: "",
        },
      ],
      [
        "live flag OFF",
        {
          UNISHIP_API_URL: "https://kh.uniship.vn",
          UNISHIP_LIVE_AUTHORIZED: "false",
          UNISHIP_ACTIVATION_POLICY_JSON: policy,
        },
      ],
      [
        "unapproved origin",
        {
          UNISHIP_API_URL: "https://other.invalid",
          UNISHIP_LIVE_AUTHORIZED: "true",
          UNISHIP_ACTIVATION_POLICY_JSON: policy,
        },
      ],
    ]) {
      const r = runtime(mode, {
        ...valid,
        NODE_ENV: "production",
        SYNC_ENABLED: "false",
        ...envPatch,
      });
      r.carrier.store.authorizeNew = async () => 0;
      r.carrier.audit.append = async () => {};
      r.carrier.store.create = async () =>
        assert.fail(`Denied connect persisted (${label})`);
      try {
        assert.equal(r.carrier.client.operationallyAvailable(), false, label);
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

  // Scoped Connect & Reconnect on approved external https://kh.uniship.vn with Sync OFF and mocked fetch
  const foreignConnectionId = "00000000-0000-4000-8000-000000000077";
  const connectionId = "00000000-0000-4000-8000-000000000055";
  const {
    LifecycleCode,
    LifecycleFailure,
  } = require("../dist/carrier/domain/lifecycle");

  const connectScenarios = [
    {
      label: "wrong owner",
      login: "synthetic",
      patch: { ownerUserId: "00000000-0000-4000-8000-000000000099" },
      expectedFetches: 0,
    },
    { label: "wrong login", login: "other", patch: {}, expectedFetches: 0 },
    {
      label: "wrong connectionId",
      login: "synthetic",
      patch: { connectionId },
      expectedFetches: 0,
    },
    {
      label: "auth verify incoherent",
      login: "synthetic",
      patch: {},
      verifyAccount: "999",
      expectedFetches: 2,
    },
    {
      label: "verified account mismatches policy",
      login: "synthetic",
      patch: {},
      account: "999",
      expectedFetches: 2,
    },
    {
      label: "valid scoped connect Sync OFF",
      login: "synthetic",
      patch: {},
      expectedFetches: 2,
      success: true,
    },
  ];

  for (const s of connectScenarios) {
    const startDispatches = dispatches;
    routeHandler = async (url, init) => {
      assert.equal(init?.method, "POST");
      const account =
        url.endsWith("/api-token-verify/") && s.verifyAccount
          ? s.verifyAccount
          : (s.account ?? "123");
      return new globalThis.Response(
        JSON.stringify({
          token: "synthetic-ext-token",
          user: { userid: account },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const r = runtime("api", {
      ...valid,
      NODE_ENV: "production",
      SYNC_ENABLED: "false",
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "true",
      UNISHIP_ACTIVATION_POLICY_JSON: JSON.stringify({
        ...JSON.parse(policy),
        ...s.patch,
      }),
    });
    let writes = 0;
    r.carrier.store.authorizeNew = async () => 0;
    r.carrier.store.create = async () => {
      writes++;
      return { status: "CONNECTED" };
    };
    r.carrier.audit.append = async () => {};
    r.carrier.admission.run = async (_ctx, signal, op) => op(signal);
    r.carrier.budget.run = async (op) => op();
    try {
      assert.equal(r.carrier.client.operationallyAvailable(), true);
      const op = r.carrier.lifecycle.connect(owner, {
        loginIdentifier: s.login,
        password: "synthetic-password",
        displayName: "Synthetic",
      });
      if (s.success) assert.equal((await op).status, "CONNECTED");
      else
        await assert.rejects(op, {
          code: s.expectedFetches
            ? "CANDIDATE_IDENTITY_MISMATCH"
            : "SERVICE_UNAVAILABLE",
        });
      assert.equal(dispatches - startDispatches, s.expectedFetches, s.label);
      assert.equal(writes, s.success ? 1 : 0, s.label);
      assert.equal(r.capabilities.resolve("uniship", "SHIPMENT"), null);
    } finally {
      await r.onApplicationShutdown();
    }
  }

  // Reconnect scenarios on approved external target (foreign 404, missing policy, wrong scope before claim, valid reconnect)
  const makeSnapshot = (overrides = {}) => ({
    generation: 1,
    version: 3,
    connection: {
      id: connectionId,
      userId: owner,
      provider: "uniship",
      externalAccountId: "123",
      loginIdentifier: "synthetic",
      displayName: "Synthetic",
      status: "CONNECTED",
      ...overrides,
    },
  });
  for (const s of [
    {
      label: "foreign connection 404",
      foreign: true,
      expectedCode: LifecycleCode.NOT_FOUND,
      claims: 0,
      fetches: 0,
    },
    {
      label: "missing policy before claim",
      blank: true,
      expectedCode: LifecycleCode.SERVICE_UNAVAILABLE,
      claims: 0,
      fetches: 0,
    },
    {
      label: "wrong owner before claim",
      patch: { ownerUserId: foreignConnectionId },
      expectedCode: LifecycleCode.SERVICE_UNAVAILABLE,
      claims: 0,
      fetches: 0,
    },
    {
      label: "wrong login before claim",
      snapshotPatch: { loginIdentifier: "other" },
      expectedCode: LifecycleCode.SERVICE_UNAVAILABLE,
      claims: 0,
      fetches: 0,
    },
    {
      label: "wrong stored account before claim",
      snapshotPatch: { externalAccountId: "999" },
      expectedCode: LifecycleCode.SERVICE_UNAVAILABLE,
      claims: 0,
      fetches: 0,
    },
    {
      label: "wrong connectionId before claim",
      patch: { connectionId: foreignConnectionId },
      expectedCode: LifecycleCode.SERVICE_UNAVAILABLE,
      claims: 0,
      fetches: 0,
    },
    {
      label: "valid external reconnect",
      expectedStatus: "CONNECTED",
      claims: 1,
      fetches: 2,
    },
  ]) {
    const startDispatches = dispatches;
    routeHandler = async () =>
      new globalThis.Response(
        JSON.stringify({
          token: "synthetic-reconnect-token",
          user: { userid: "123" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    const r = runtime("api", {
      ...valid,
      NODE_ENV: "production",
      SYNC_ENABLED: "false",
      UNISHIP_API_URL: "https://kh.uniship.vn",
      UNISHIP_LIVE_AUTHORIZED: "true",
      UNISHIP_ACTIVATION_POLICY_JSON: s.blank
        ? ""
        : JSON.stringify({ ...JSON.parse(policy), ...s.patch }),
    });
    let claims = 0;
    let completions = 0;
    r.carrier.store.read = async (uid, cid) => {
      if (s.foreign || uid !== owner || cid !== connectionId)
        throw new LifecycleFailure(LifecycleCode.NOT_FOUND);
      return makeSnapshot(s.snapshotPatch);
    };
    r.carrier.store.claimReconnect = async (_uid, _cid, snap) => {
      claims++;
      return snap;
    };
    r.carrier.store.complete = async () => {
      completions++;
      return { status: "CONNECTED" };
    };
    r.carrier.store.fail = async () =>
      assert.fail(`Unexpected status downgrade (${s.label})`);
    r.carrier.audit.append = async () => {};
    r.carrier.admission.run = async (_ctx, signal, op) => op(signal);
    r.carrier.budget.run = async (op) => op();
    try {
      const op = r.carrier.lifecycle.reconnect(
        s.foreign ? foreignConnectionId : owner,
        connectionId,
        "synthetic-password",
      );
      if (s.expectedStatus) assert.equal((await op).status, s.expectedStatus);
      else await assert.rejects(op, { code: s.expectedCode });
      assert.equal(claims, s.claims, s.label);
      assert.equal(dispatches - startDispatches, s.fetches, s.label);
      assert.equal(completions, s.expectedStatus ? 1 : 0, s.label);
    } finally {
      await r.onApplicationShutdown();
    }
  }
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
