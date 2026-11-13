import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createSmokeChecks, untrustedHostStatus } from "./smoke-checks.mjs";

test("Host-negative transport sends the actual forged Host through HTTP ingress", async () => {
  let observed;
  const server = createServer((req, res) => {
    observed = req.headers.host;
    res.statusCode = observed === "evil.example" ? 400 : 200;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    assert.equal(
      await untrustedHostStatus(
        `http://127.0.0.1:${server.address().port}/api/health/live`,
      ),
      400,
    );
    assert.equal(observed, "evil.example");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("smoke failure reports step and status without assertion payloads or secrets", () => {
  const lines = [];
  const checks = createSmokeChecks((line) => lines.push(line));
  checks.step("LOGIN_VALID_PASSWORD");
  try {
    checks.status(403, 200);
  } catch (error) {
    error.message = "password=cookie=token=private-diagnostic";
    checks.failure(error);
  }
  assert.deepEqual(lines, [
    "AUTH_RUNTIME_SMOKE_FAILED",
    "Step: LOGIN_VALID_PASSWORD",
    "Expected HTTP status: 200",
    "Actual HTTP status: 403",
    "Category: ASSERTION_FAILED",
  ]);
  checks.step("SESSION_EXPIRED");
  checks.failure({
    cause: { code: "ECONNREFUSED", secret: "private" },
    message: "private",
  });
  assert.equal(lines.at(-1), "Category: CONNECTION_REFUSED");
  assert.equal(
    lines.slice(5).some((line) => line.includes("HTTP status")),
    false,
  );
  assert.equal(lines.join("\n").includes("private"), false);
});

test("status diagnostics never stringify unexpected payload objects", () => {
  const lines = [];
  const checks = createSmokeChecks((line) => lines.push(line));
  checks.step("LOGIN_VALID_PASSWORD");
  try {
    checks.status({ cookie: "private-cookie", token: "private-token" }, 200);
  } catch (error) {
    checks.failure(error);
  }
  assert.ok(lines.includes("Actual HTTP status: NOT_OBSERVED"));
  assert.equal(lines.join("\n").includes("private"), false);
});

test("browser diagnostics map fixed diagnostic vocabulary codes without payload leakage", () => {
  const codes = [
    "SELECTOR_NOT_FOUND",
    "CONTROL_DISABLED",
    "FOCUS_MISMATCH",
    "PROTOCOL_EXCEPTION",
    "VALUE_MISMATCH",
  ];
  for (const code of codes) {
    const lines = [];
    const checks = createSmokeChecks((line) => lines.push(line));
    checks.step("TEST_STEP");
    const err = new Error("diagnostic failure");
    err.code = code;
    checks.failure(err);
    assert.deepEqual(lines, [
      "AUTH_RUNTIME_SMOKE_FAILED",
      "Step: TEST_STEP",
      `Category: ${code}`,
    ]);
  }
});

test("opt-in diagnostics report allowlisted error type and step elapsed time without payloads", () => {
  let clock = 1000;
  const lines = [];
  const checks = createSmokeChecks(
    (line) => lines.push(line),
    "PUBLIC_HTTPS_SMOKE_FAILED",
    { diagnostics: true, now: () => clock },
  );
  checks.step("ADMIN_BROWSER_RECOVERY_VERIFY");
  clock = 13456;
  checks.failure(Object.assign(new TypeError("private-url"), {}));
  assert.deepEqual(lines, [
    "PUBLIC_HTTPS_SMOKE_FAILED",
    "Step: ADMIN_BROWSER_RECOVERY_VERIFY",
    "Category: CHECK_FAILED",
    "Error type: TypeError",
    "Step elapsed ms: 12456",
  ]);
  lines.length = 0;
  checks.step("CANONICAL_HTTPS_REMOTE_OPERATOR_SETUP");
  checks.failure(
    Object.assign(new Error("private"), { name: "PrivateCustomError" }),
  );
  assert.ok(lines.includes("Error type: OTHER"));
  lines.length = 0;
  checks.failure(
    Object.assign(new Error("CDP timeout"), { name: "TimeoutError" }),
  );
  assert.ok(lines.includes("Category: REQUEST_TIMEOUT"));
  assert.ok(lines.includes("Error type: TimeoutError"));
  assert.equal(lines.join("\n").includes("private"), false);
});

test("diagnostics stay off by default", () => {
  const lines = [];
  const checks = createSmokeChecks((line) => lines.push(line));
  checks.step("X");
  checks.failure(new TypeError("private"));
  assert.equal(
    lines.some(
      (l) => l.startsWith("Error type:") || l.startsWith("Step elapsed ms:"),
    ),
    false,
  );
});
