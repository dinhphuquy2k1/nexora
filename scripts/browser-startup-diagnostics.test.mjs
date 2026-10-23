import test from "node:test";
import assert from "node:assert/strict";
import { browserStartupSummary } from "./browser-startup-diagnostics.mjs";
test("startup diagnostics expose only fixed hints and numeric status, never raw browser output", () => {
  const secret = "private-credential-and-url";
  const summary = browserStartupSummary(
    `FATAL pthread_create: Resource temporarily unavailable ${secret}`,
    { exitCode: 133, signalCode: "SIGTRAP" },
  );
  assert.deepEqual(summary.hints, ["RESOURCE_LIMIT", "CRASH"]);
  assert.equal(summary.exitCode, 133);
  assert.equal(summary.signal, "SIGTRAP");
  assert.equal(JSON.stringify(summary).includes(secret), false);
  assert.equal(
    browserStartupSummary(secret, { exitCode: secret, signalCode: secret })
      .signal,
    null,
  );
  assert.equal(browserStartupSummary(secret).exitCode, null);
});
