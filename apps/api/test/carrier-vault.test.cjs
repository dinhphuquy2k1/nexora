const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CarrierCredentialVault,
} = require("../dist/carrier/infrastructure/carrier-credential-vault");
const { LifecycleCode } = require("../dist/carrier/domain/lifecycle");

test("durable audit failure blocks both password decrypt and provider login", async () => {
  const calls = [];
  const reader = {
    load: async () => {
      calls.push("authorize");
      return { password: {}, loginIdentifier: "synthetic" };
    },
  };
  const audit = {
    append: async () => {
      calls.push("audit");
      throw Error("synthetic unavailable");
    },
  };
  const cipher = {
    decrypt: () => {
      calls.push("decrypt");
      return "synthetic";
    },
  };
  const provider = {
    acquire: async () => {
      calls.push("login");
    },
  };
  const vault = new CarrierCredentialVault(reader, cipher, provider, audit);
  await assert.rejects(
    vault.acquireStored(
      "owner",
      {
        connection: { id: "connection", provider: "uniship" },
        generation: 0,
        version: 1,
      },
      "correlation",
    ),
    { code: LifecycleCode.AUDIT_UNAVAILABLE },
  );
  assert.deepEqual(calls, ["authorize", "audit"]);
});
test("audit commit and owner/fence recheck precede password decrypt then provider login", async () => {
  const calls = [];
  const reader = {
    load: async () => {
      calls.push("authorize");
      return { password: {}, loginIdentifier: "synthetic" };
    },
  };
  const audit = {
    append: async (event) => {
      calls.push("audit-committed");
      assert.equal(JSON.stringify(event).includes("synthetic"), false);
    },
  };
  const cipher = {
    decrypt: () => {
      calls.push("decrypt");
      return "synthetic-password";
    },
    encrypt: (_purpose, _aad, value) => {
      calls.push("encrypt");
      return { ciphertext: `sealed:${value.length}` };
    },
  };
  const provider = {
    acquire: async (_login, password) => {
      calls.push("login-verify");
      assert.equal(password, "synthetic-password");
      return {
        token: "synthetic-token",
        externalAccountId: "1",
        expiresAt: null,
      };
    },
  };
  const vault = new CarrierCredentialVault(reader, cipher, provider, audit);
  const candidate = await vault.acquireStored(
    "owner",
    {
      connection: { id: "connection", provider: "uniship" },
      generation: 0,
      version: 1,
    },
    "correlation",
  );
  assert.deepEqual(calls, [
    "authorize",
    "audit-committed",
    "authorize",
    "decrypt",
    "login-verify",
    "encrypt",
    "encrypt",
  ]);
  assert.equal(candidate.externalAccountId, "1");
  assert.equal(JSON.stringify(candidate).includes("synthetic"), false);
});
