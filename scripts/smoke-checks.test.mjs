import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import {
  createSmokeChecks,
  formatDevSmokeFailure,
  summarizeComposeServices,
  untrustedHostStatus,
  verifyDevSmokeDependenciesReady,
} from "./smoke-checks.mjs";

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

test("starting a request clears previous response status before headerless failure", () => {
  const lines = [];
  const checks = createSmokeChecks((line) => lines.push(line));
  checks.step("CREATE_AND_REISSUE");
  checks.status(201, 201);
  checks.requestStarted();
  checks.failure(new TypeError("private"));
  assert.ok(lines.includes("Actual HTTP status: NOT_OBSERVED"));
  assert.equal(lines.includes("Actual HTTP status: 201"), false);
});

test("custom Host acceptance uses the supplied raw authority without fetch rewriting", async () => {
  const { hostStatus } = await import("./smoke-checks.mjs");
  let observed;
  const server = createServer((req, res) => {
    observed = req.headers.host;
    res.statusCode = observed === "nexora-dev.fixture" ? 200 : 400;
    res.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    assert.equal(
      await hostStatus(
        `http://127.0.0.1:${server.address().port}/api/health/live`,
        "nexora-dev.fixture",
      ),
      200,
    );
    assert.equal(observed, "nexora-dev.fixture");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("summarizeComposeServices projects only allowlisted service fields without secrets or raw command text", () => {
  const secret = "postgresql://nexora:top-secret@postgres/nexora";
  const psLines = [
    JSON.stringify({
      Service: "postgres",
      State: "running",
      Health: "healthy",
      ExitCode: 0,
      Command: `postgres -c ${secret}`,
      Labels: "secret=value",
      Status: `Up 10s ${secret}`,
    }),
    JSON.stringify({
      Service: "dependencies",
      State: "exited",
      Health: "",
      ExitCode: 0,
    }),
    JSON.stringify({
      Service: "api",
      State: "running",
      Health: "unhealthy",
      ExitCode: 0,
    }),
  ].join("\n");

  const summary = summarizeComposeServices(psLines);
  assert.equal(summary.available, true);
  assert.deepEqual(summary.services, [
    { service: "postgres", state: "running", health: "healthy", exitCode: 0 },
    {
      service: "dependencies",
      state: "exited",
      health: "unknown",
      exitCode: 0,
    },
    { service: "api", state: "running", health: "unhealthy", exitCode: 0 },
  ]);
  assert.equal(JSON.stringify(summary).includes(secret), false);
  assert.equal(JSON.stringify(summary).includes("secret=value"), false);
  assert.equal(summarizeComposeServices("not-json").available, false);
});

test("verifyDevSmokeDependenciesReady fails closed when dependencies or postgres are unready", () => {
  const readyPs = [
    { Service: "postgres", State: "running", Health: "healthy", ExitCode: 0 },
    { Service: "dependencies", State: "exited", Health: "", ExitCode: 0 },
    { Service: "migrate", State: "exited", Health: "", ExitCode: 0 },
    { Service: "db-runtime", State: "exited", Health: "", ExitCode: 0 },
    { Service: "sync-worker", State: "running", Health: "", ExitCode: 0 },
  ]
    .map((r) => JSON.stringify(r))
    .join("\n");
  assert.equal(verifyDevSmokeDependenciesReady(readyPs).ready, true);

  const unhealthyPg = readyPs.replace('"healthy"', '"unhealthy"');
  const unhealthyRes = verifyDevSmokeDependenciesReady(unhealthyPg);
  assert.equal(unhealthyRes.ready, false);
  assert.deepEqual(unhealthyRes.failedServices, ["postgres"]);

  const failedDepsRes = verifyDevSmokeDependenciesReady(
    [
      { Service: "postgres", State: "running", Health: "healthy", ExitCode: 0 },
      { Service: "dependencies", State: "exited", Health: "", ExitCode: 1 },
      { Service: "migrate", State: "exited", Health: "", ExitCode: 0 },
      { Service: "db-runtime", State: "exited", Health: "", ExitCode: 0 },
    ]
      .map((r) => JSON.stringify(r))
      .join("\n"),
  );
  assert.equal(failedDepsRes.ready, false);
  assert.ok(failedDepsRes.failedServices.includes("dependencies"));
});

test("formatDevSmokeFailure emits bounded sanitized telemetry without raw logs or credentials", () => {
  const secret = "super-secret-password-marker";
  const output = formatDevSmokeFailure({
    phase: `RECREATE_API_WITH_EXPLICIT_ORIGIN ${secret}`,
    phaseElapsedMs: 102345,
    servicesSummary: summarizeComposeServices(
      JSON.stringify({
        Service: "api",
        State: "running",
        Health: "unhealthy",
        ExitCode: 0,
      }),
    ),
    apiListenerPresent: false,
    liveStatus: 200,
    readyChecks: { status: 503, database: false, storage: true },
  });
  assert.equal(output.phase, "UNKNOWN");
  assert.equal(output.phaseElapsedMs, 102345);
  assert.equal(output.apiListenerPresent, false);
  assert.equal(output.liveStatus, 200);
  assert.equal(output.readyStatus, 503);
  assert.equal(output.databaseReady, false);
  assert.equal(output.storageReady, true);
  assert.equal(JSON.stringify(output).includes(secret), false);

  const valid = formatDevSmokeFailure({
    phase: "RECREATE_API_WITH_EXPLICIT_ORIGIN",
    phaseElapsedMs: 123,
    servicesSummary: { available: true, services: [] },
    apiListenerPresent: true,
    liveStatus: 200,
    readyChecks: { status: 200, database: true, storage: true },
  });
  assert.equal(valid.phase, "RECREATE_API_WITH_EXPLICIT_ORIGIN");
});

test("dev-smoke.sh recreates api with --no-deps after prerequisite verification and checks sync-worker stop around dependencies rebuild", async () => {
  const script = await readFile(
    new URL("./dev-smoke.sh", import.meta.url),
    "utf8",
  );
  assert.match(script, /compose stop api sync-worker web/);
  assert.match(script, /verifyDevSmokeDependenciesReady/);
  assert.match(
    script,
    /compose up -d --no-deps --no-build --force-recreate --wait --wait-timeout 180 api/,
  );
  assert.match(script, /waitForDevelopmentEnvironment/);
  assert.match(script, /formatDevSmokeFailure/);
});
