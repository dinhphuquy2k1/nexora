const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  UserCarrierAdmission,
  ProviderBudget,
} = require("../dist/carrier/infrastructure/uniship/provider-budget");
const {
  LifecycleFailure,
  LifecycleCode,
} = require("../dist/carrier/domain/lifecycle");
const {
  UnishipAdapter,
  tokenExpiry,
} = require("../dist/carrier/infrastructure/uniship/uniship-adapter");

test("Nexora admission is per user, bounded and expires without a timer", () => {
  let now = 0;
  const admission = new UserCarrierAdmission(() => now);
  for (let i = 0; i < 5; i++) admission.admit("user1");
  assert.throws(() => admission.admit("user1"), {
    code: LifecycleCode.RATE_LIMITED,
  });
  admission.admit("user2");
  for (let i = 0; i < 1022; i++) admission.admit(`u${i}`);
  assert.throws(() => admission.admit("overflow"));
  now = 60000;
  admission.admit("user1");
});

test("provider concurrency fails fast, release occurs on failure and Retry-After backoff is bounded", async () => {
  let now = 0;
  const budget = new ProviderBudget(() => now);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const a = budget.run(() => gate),
    b = budget.run(() => gate);
  await assert.rejects(
    budget.run(async () => {}),
    { code: LifecycleCode.RATE_LIMITED },
  );
  release();
  await Promise.all([a, b]);
  let calls = 0;
  const fail = () =>
    budget.run(async () => {
      calls++;
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    });
  await assert.rejects(fail());
  await assert.rejects(fail(), { code: LifecycleCode.RATE_LIMITED });
  assert.equal(calls, 1);
  now = 1000;
  await assert.rejects(fail());
  now = 2999;
  await assert.rejects(fail());
  assert.equal(calls, 2);
  now = 3000;
  await assert.rejects(
    budget.run(async () => {
      throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 99999999);
    }),
  );
  now += 299999;
  await assert.rejects(budget.run(async () => 1));
  now++;
  assert.equal(await budget.run(async () => 1), 1);
});

test("adapter verifies every acquired token and keeps login/verify identity coherent", async () => {
  const calls = [];
  const client = {
    authenticate: async () => {
      calls.push("login");
      return { externalAccountId: "1", candidateToken: "synthetic" };
    },
    verify: async (token) => {
      calls.push(["verify", token]);
      return { externalAccountId: "1" };
    },
  };
  const adapter = new UnishipAdapter(client);
  assert.deepEqual(await adapter.acquire("synthetic", "synthetic"), {
    externalAccountId: "1",
    token: "synthetic",
    expiresAt: null,
  });
  assert.deepEqual(calls, ["login", ["verify", "synthetic"]]);
  client.verify = async () => ({ externalAccountId: "2" });
  await assert.rejects(adapter.acquire("synthetic", "synthetic"), {
    code: LifecycleCode.IDENTITY_MISMATCH,
  });
  assert.equal(tokenExpiry("opaque"), null);
  const jwt = (exp) =>
    `synthetic.${Buffer.from(JSON.stringify({ exp, sub: "never-identity" })).toString("base64url")}.synthetic`;
  assert.equal(tokenExpiry(jwt(123)).getTime(), 123000);
  assert.equal(tokenExpiry(jwt("123")), null);
});
