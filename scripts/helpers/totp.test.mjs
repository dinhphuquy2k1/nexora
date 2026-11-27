import { test } from "node:test";
import assert from "node:assert/strict";
import { totp, totpAtStep } from "./totp.mjs";
const publicRfcKey = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
test("extracted independent TOTP retains RFC SHA1 vectors and zero padding", () => {
  for (const [seconds, expected] of [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])
    assert.ok(
      totpAtStep(publicRfcKey, Math.floor(seconds / 30)) === expected,
      "RFC6238 fixture matches",
    );
});
test("browser offset API delegates to same step algorithm", () => {
  const original = Date.now;
  Date.now = () => 1234567890000;
  try {
    for (const offset of [-1, 0, 1])
      assert.ok(
        totp(publicRfcKey, offset) ===
          totpAtStep(publicRfcKey, Math.floor(Date.now() / 30000) + offset),
        "offset behavior unchanged",
      );
  } finally {
    Date.now = original;
  }
});
