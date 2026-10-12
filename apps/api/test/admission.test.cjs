const { test } = require("node:test");
const assert = require("node:assert/strict");
const { AuthService } = require("../dist/identity/application/auth.service");

function harness() {
  let time = 0;
  let lookups = 0;
  let verifications = 0;
  const port = {
    findUserByUsername: async () => {
      lookups++;
      return null;
    },
    verifyPassword: async () => {
      verifications++;
      return false;
    },
  };
  return {
    auth: new AuthService(port, () => time),
    port,
    advance(ms) {
      time += ms;
    },
    get lookups() {
      return lookups;
    },
    get verifications() {
      return verifications;
    },
  };
}
const unauthorized = (e) => e.getStatus?.() === 401;
const throttled = (e) => e.getStatus?.() === 429;

test("global admission bounds rotating usernames before lookup or Scrypt", async () => {
  const h = harness();
  for (let i = 0; i < 10; i++)
    await assert.rejects(h.auth.login(`user-${i}`, "password"), unauthorized);
  await assert.rejects(h.auth.login("rotated-user", "password"), throttled);
  assert.equal(h.lookups, 10);
  assert.equal(h.verifications, 10);
  h.advance(1000);
  await assert.rejects(h.auth.login("rotated-user", "password"), unauthorized);
  assert.equal(h.verifications, 11);
});

test("concurrent admissions reserve budget before awaiting lookup", async () => {
  const h = harness();
  const releases = [];
  h.port.findUserByUsername = () =>
    new Promise((resolve) => releases.push(resolve));
  const requests = Array.from({ length: 4 }, (_, i) =>
    h.auth.login(`user-${i}`, "password"),
  );
  const results = Promise.allSettled(requests);
  const fifth = h.auth.login("fifth-user", "password");
  const fifthResult = Promise.allSettled([fifth]);
  const admitted = releases.length;
  for (const release of releases) release(null);
  const settled = await results;
  assert.equal(admitted, 4);
  assert.ok(throttled((await fifthResult)[0].reason));
  assert.ok(
    settled.every(
      (result) => result.status === "rejected" && unauthorized(result.reason),
    ),
  );
});

test("capacity evicts oldest unlocked entry and preserves active lockouts", async () => {
  const h = harness();
  // Controlled clock/state creates a full cache without performing 640 real Scrypt calls.
  for (let i = 0; i < 128; i++)
    h.auth.rateLimits.set(`locked-${i}`, {
      count: 5,
      pending: 0,
      resetAt: 300000,
    });
  await assert.rejects(h.auth.login("new-account", "password"), throttled);
  assert.equal(h.lookups, 0);
  assert.equal(h.auth.rateLimits.size, 128);
  h.auth.rateLimits.set("locked-0", { count: 1, pending: 0, resetAt: 300000 });
  await assert.rejects(h.auth.login("new-account", "password"), unauthorized);
  assert.equal(h.auth.rateLimits.size, 128);
  assert.equal(h.auth.rateLimits.has("locked-0"), false);
  assert.equal(h.auth.rateLimits.get("locked-1").count, 5);
  h.advance(300000);
  await assert.rejects(
    h.auth.login("another-account", "password"),
    unauthorized,
  );
  assert.equal(h.auth.rateLimits.size, 1);
});

test("bounded state remains within cap for an extended rotating-username stream", async () => {
  const h = harness();
  for (let i = 0; i < 200; i++) {
    await assert.rejects(
      h.auth.login(`rotated-${i}`, "password"),
      unauthorized,
    );
    assert.ok(h.auth.rateLimits.size <= 128);
    h.advance(1000);
  }
});

test("successful Login clears only its account failures and releases reservations", async () => {
  const h = harness();
  h.port.findUserByUsername = async (username) => ({
    id: username,
    username,
    isActive: true,
    passwordHash: "fixture",
  });
  h.port.verifyPassword = async (password) => password === "correct";
  h.port.createSession = async () => {};
  for (let i = 0; i < 4; i++)
    await assert.rejects(h.auth.login("operator", "wrong"), unauthorized);
  await h.auth.login("operator", "correct");
  assert.equal(h.auth.rateLimits.has("operator"), false);
  for (let i = 0; i < 4; i++)
    await assert.rejects(h.auth.login("operator", "wrong"), unauthorized);
  assert.equal(h.auth.rateLimits.get("operator").count, 4);
  assert.equal(h.auth.pending, 0);
  assert.equal(h.auth.rateLimits.get("operator").pending, 0);
});

test("database failure releases concurrent admission without resetting global budget", async () => {
  const h = harness();
  h.port.findUserByUsername = async () => {
    throw new Error("fixture failure");
  };
  await assert.rejects(h.auth.login("operator", "password"), /fixture failure/);
  assert.equal(h.auth.pending, 0);
  assert.equal(h.auth.rateLimits.size, 0);
  assert.equal(h.auth.tokens, 9);
});
