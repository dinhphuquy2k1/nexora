import test from "node:test";
import assert from "node:assert/strict";
import { createAuthRequestDiagnostics } from "./auth-request-diagnostics.mjs";

const origin = "https://nexora.example.test:34567";
function fixture() {
  let time = 10;
  const diagnostics = createAuthRequestDiagnostics(origin, () => time);
  const observe = (method, params) => diagnostics.observe({ method, params });
  const start = (requestId = "1", path = "/api/auth/login", extra = {}) =>
    observe("Network.requestWillBeSent", {
      requestId,
      request: { url: origin + path, method: "POST", ...extra },
    });
  return {
    diagnostics,
    observe,
    start,
    advance: () => {
      time += 25;
    },
  };
}

test("distinguishes pending, HTTP response and finished JSON login outcome without exposing payload", () => {
  const f = fixture();
  f.start();
  f.advance();
  assert.deepEqual(f.diagnostics.snapshot().requests, [
    { operation: "LOGIN", state: "PENDING", elapsedMs: 25 },
  ]);
  f.observe("Network.responseReceived", {
    requestId: "1",
    response: { status: 200, headers: { "set-cookie": "secret-cookie" } },
  });
  assert.equal(f.diagnostics.snapshot().requests[0].state, "HTTP_RESPONSE");
  assert.equal(f.observe("Network.loadingFinished", { requestId: "1" }), "1");
  f.diagnostics.body(
    "1",
    JSON.stringify({ mfaRequired: true, token: "secret-token" }),
    false,
  );
  assert.deepEqual(f.diagnostics.snapshot().requests[0], {
    operation: "LOGIN",
    state: "FINISHED",
    elapsedMs: 25,
    status: 200,
    outcome: "mfa",
  });
  assert.doesNotMatch(JSON.stringify(f.diagnostics.snapshot()), /secret/);
});

test("transport failures retain only closed diagnostic categories and no raw CDP fields", () => {
  const f = fixture();
  f.start();
  f.advance();
  f.observe("Network.loadingFailed", {
    requestId: "1",
    errorText: "net::ERR_HTTP2_PROTOCOL_ERROR",
    blockedReason: "csp",
    corsErrorStatus: { corsError: "secret-details" },
    secret: "secret-payload",
  });
  assert.deepEqual(f.diagnostics.snapshot().requests[0], {
    operation: "LOGIN",
    state: "FAILED",
    elapsedMs: 25,
    transportCode: "net::ERR_HTTP2_PROTOCOL_ERROR",
    blockedReason: "csp",
    corsFailure: true,
  });
  const unknown = fixture();
  unknown.start();
  unknown.observe("Network.loadingFailed", {
    requestId: "1",
    errorText: "secret-exception",
    blockedReason: "secret-block",
  });
  assert.equal(
    unknown.diagnostics.snapshot().requests[0].transportCode,
    "OTHER",
  );
  assert.doesNotMatch(
    JSON.stringify([f.diagnostics.snapshot(), unknown.diagnostics.snapshot()]),
    /secret/,
  );
});

test("HTTP errors, malformed successes and exceptions remain different observations", () => {
  for (const [status, body, outcome, errorCode] of [
    [200, '{"mfaRequired":false}', "invalid", undefined],
    [200, '{"user":{"id":"u","username":"synthetic"}}', "session", undefined],
    [200, "secret-not-json", "UNREADABLE_JSON", undefined],
    [
      403,
      '{"code":"MFA_ENROLLMENT_REQUIRED"}',
      undefined,
      "MFA_ENROLLMENT_REQUIRED",
    ],
    [
      500,
      '{"code":"secret-code","message":"secret-message"}',
      undefined,
      "OTHER",
    ],
  ]) {
    const f = fixture();
    f.start();
    f.observe("Network.responseReceived", {
      requestId: "1",
      response: { status },
    });
    f.observe("Network.loadingFinished", { requestId: "1" });
    f.diagnostics.body("1", body, false);
    const record = f.diagnostics.snapshot().requests[0];
    assert.equal(record.status, status);
    assert.equal(record.outcome, outcome);
    assert.equal(record.errorCode, errorCode);
    assert.doesNotMatch(JSON.stringify(record), /secret|synthetic/);
  }
  const f = fixture();
  f.observe("Runtime.exceptionThrown", {
    exceptionDetails: { text: "secret-exception" },
  });
  assert.equal(f.diagnostics.snapshot().runtimeExceptions, 1);
  assert.doesNotMatch(JSON.stringify(f.diagnostics.snapshot()), /secret/);
});

test("ignores unrelated origins/methods/paths, bounds state, snapshots are detached and bodies fail closed", () => {
  const f = fixture();
  f.start("foreign", "/api/auth/login", {
    url: "https://evil.example/api/auth/login",
  });
  f.start("get", "/api/auth/login", { method: "GET" });
  f.start("other", "/customers");
  assert.equal(f.diagnostics.snapshot().requests.length, 0);
  for (let i = 0; i < 100; i++) f.start(String(i));
  assert.equal(f.diagnostics.snapshot().requests.length, 16);
  f.diagnostics.body("0", "secret", true);
  assert.equal(f.diagnostics.snapshot().requests[0].outcome, undefined);
  f.observe("Network.responseReceived", {
    requestId: "0",
    response: { status: 200 },
  });
  f.observe("Network.loadingFinished", { requestId: "0" });
  f.diagnostics.body("0", "secret", true);
  assert.equal(
    f.diagnostics.snapshot().requests[0].outcome,
    "BODY_UNAVAILABLE",
  );
  const snapshot = f.diagnostics.snapshot();
  snapshot.requests[0].operation = "secret";
  assert.equal(f.diagnostics.snapshot().requests[0].operation, "LOGIN");
});

test("setup success reports JSON observation without pretending to validate a login payload", () => {
  const f = fixture();
  f.start("setup", "/api/auth/setup-password");
  f.observe("Network.responseReceived", {
    requestId: "setup",
    response: { status: 200 },
  });
  f.observe("Network.loadingFinished", { requestId: "setup" });
  f.diagnostics.body("setup", '{"success":true}', false);
  assert.equal(f.diagnostics.snapshot().requests[0].outcome, "JSON_OBSERVED");
});
