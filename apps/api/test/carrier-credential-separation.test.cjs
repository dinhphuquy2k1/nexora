const { test } = require("node:test");
const { AbortController } = globalThis;
const assert = require("node:assert/strict");
const {
  CarrierCredentialVault,
} = require("../dist/carrier/infrastructure/carrier-credential-vault");
const snapshot = {
  connection: { id: "synthetic", provider: "uniship" },
  generation: 0,
  version: 1,
};
function fixture({ auditFailure = false, stale = false } = {}) {
  const calls = [];
  const reader = {
    // Same behavioral harness supports the reviewed combined reader and candidate.
    load: async () => {
      calls.push("combined-password-read");
      // Baseline also reauthorizes after audit; model the same stale boundary.
      if (stale && calls.includes("audit")) throw Error("stale-after-audit");
      return { token: {}, password: {}, loginIdentifier: "synthetic" };
    },
    loadToken: async () => {
      calls.push("token-read");
      return { token: {} };
    },
    authorizeRecovery: async () => {
      calls.push("authorize");
    },
    loadRecoveryPassword: async () => {
      calls.push("password-read");
      if (stale) throw Error("stale-after-audit");
      return { password: {}, loginIdentifier: "synthetic" };
    },
  };
  const audit = {
    append: async () => {
      calls.push("audit");
      if (auditFailure) throw Error("unavailable");
    },
  };
  const cipher = {
    decrypt: (purpose) => {
      calls.push(purpose);
      return "synthetic";
    },
    encrypt: () => ({}),
  };
  const provider = {
    acquire: async () => {
      calls.push("http");
      return { externalAccountId: "1", token: "synthetic", expiresAt: null };
    },
  };
  return {
    calls,
    vault: new CarrierCredentialVault(reader, cipher, provider, audit),
  };
}
test("token operation reads only token and never password or password audit", async () => {
  const { calls, vault } = fixture();
  await vault.useToken("owner", snapshot, async () => {
    calls.push("callback");
  });
  assert.deepEqual(calls, ["token-read", "CARRIER_TOKEN", "callback"]);
});
test("recovery authorizes without ciphertext then commits audit before password-only read", async () => {
  const { calls, vault } = fixture();
  await vault.acquireStored("owner", snapshot, "correlation");
  assert.deepEqual(calls, [
    "authorize",
    "audit",
    "password-read",
    "CARRIER_PASSWORD",
    "http",
  ]);
});
test("audit failure prevents password read decrypt and HTTP", async () => {
  const { calls, vault } = fixture({ auditFailure: true });
  await assert.rejects(vault.acquireStored("owner", snapshot, "correlation"), {
    code: "AUDIT_UNAVAILABLE",
  });
  assert.deepEqual(calls, ["authorize", "audit"]);
});
test("post-audit authorization failure preserves audit and prevents decrypt/HTTP", async () => {
  const { calls, vault } = fixture({ stale: true });
  await assert.rejects(
    vault.acquireStored("owner", snapshot, "correlation"),
    /stale-after-audit/,
  );
  assert.deepEqual(calls, ["authorize", "audit", "password-read"]);
});
const {
  CarrierConnectionLifecycleService,
} = require("../dist/carrier/application/carrier-connection-lifecycle.service");
test("activation-denied reconnect never claims or mutates lifecycle", async () => {
  let claims = 0,
    http = 0;
  const denied = () => {
    const error = Error("activation-denied");
    error.code = "SERVICE_UNAVAILABLE";
    throw error;
  };
  const store = {
    read: async () => ({
      ...snapshot,
      connection: { ...snapshot.connection, loginIdentifier: "synthetic" },
    }),
    claim: async () => {
      claims++;
      return {
        ...snapshot,
        connection: { ...snapshot.connection, loginIdentifier: "synthetic" },
      };
    },
    claimReconnect: async () => {
      claims++;
      return snapshot;
    },
    fail: async () => {},
  };
  const credentials = {
    authorizeReconnect: async () => denied(),
    acquireNew: async () => {
      denied();
      http++;
    },
  };
  const service = new CarrierConnectionLifecycleService(
    store,
    credentials,
    { admit() {} },
    { append: async () => {} },
  );
  await assert.rejects(service.reconnect("owner", "synthetic", "synthetic"));
  assert.equal(claims, 0);
  assert.equal(http, 0);
});

for (const boundary of ["authorize", "audit", "password-read"])
  test(`recovery cancellation after ${boundary} prevents decrypt and HTTP`, async () => {
    const abort = new AbortController(),
      calls = [];
    const step = (name) => {
      calls.push(name);
      if (name === boundary) abort.abort();
    };
    const reader = {
      authorizeRecovery: async () => step("authorize"),
      loadRecoveryPassword: async () => {
        step("password-read");
        return { password: {}, loginIdentifier: "synthetic" };
      },
    };
    const vault = new CarrierCredentialVault(
      reader,
      { decrypt: () => assert.fail("no decrypt after cancellation") },
      { acquire: async () => assert.fail("no HTTP after cancellation") },
      { append: async () => step("audit") },
    );
    await assert.rejects(
      vault.acquireStored("owner", snapshot, "correlation", {
        signal: abort.signal,
      }),
      { name: "AbortError" },
    );
    assert.deepEqual(
      calls,
      ["authorize", "audit", "password-read"].slice(
        0,
        ["authorize", "audit", "password-read"].indexOf(boundary) + 1,
      ),
    );
  });
