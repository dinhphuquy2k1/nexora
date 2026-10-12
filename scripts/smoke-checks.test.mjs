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
