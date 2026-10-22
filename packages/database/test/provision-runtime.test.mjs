import { test } from "node:test";
import assert from "node:assert/strict";
import {
  provisionRuntime,
  isRetryableProvisionError,
} from "../scripts/provision-runtime.mjs";

test("isRetryableProvisionError correctly classifies retryable and permanent errors", () => {
  // 55P03 = lock_not_available (e.g. lock_timeout elapsed waiting for concurrent provisioner)
  assert.equal(isRetryableProvisionError({ code: "55P03" }), true);

  // XX000 with routine simple_heap_update = catalog tuple update conflict
  assert.equal(
    isRetryableProvisionError({
      code: "XX000",
      routine: "simple_heap_update",
      message: "tuple concurrently updated",
    }),
    true,
  );

  // XX000 with message match fallback
  assert.equal(
    isRetryableProvisionError({
      code: "XX000",
      message: "error: tuple concurrently updated",
    }),
    true,
  );

  // Generic XX000 without simple_heap_update or concurrently updated is not retryable
  assert.equal(
    isRetryableProvisionError({
      code: "XX000",
      routine: "some_other_routine",
      message: "disk full or catalog corruption",
    }),
    false,
  );

  // Permanent errors must never be retried
  assert.equal(
    isRetryableProvisionError({ code: "42501", message: "permission denied" }),
    false,
  );
  assert.equal(
    isRetryableProvisionError({
      code: "28P01",
      message: "password authentication failed",
    }),
    false,
  );
  assert.equal(
    isRetryableProvisionError({
      code: "3D000",
      message: "database does not exist",
    }),
    false,
  );
  assert.equal(
    isRetryableProvisionError({
      code: "42P01",
      message: "relation does not exist",
    }),
    false,
  );
  assert.equal(isRetryableProvisionError(new Error("generic error")), false);
  assert.equal(isRetryableProvisionError(null), false);
  assert.equal(isRetryableProvisionError(undefined), false);
});

test("provisionRuntime rejects invalid password secret format and invalid timeout", async () => {
  await assert.rejects(
    provisionRuntime("postgresql://invalid", "short_secret"),
    (err) => err.message === "INVALID_RUNTIME_SECRET",
  );
  await assert.rejects(
    provisionRuntime("postgresql://invalid", "g".repeat(64)),
    (err) => err.message === "INVALID_RUNTIME_SECRET",
  );
  await assert.rejects(
    provisionRuntime("postgresql://invalid", ""),
    (err) => err.message === "INVALID_RUNTIME_SECRET",
  );
  for (const invalidTimeout of [
    "invalid;injection",
    "0s",
    "0ms",
    "0",
    "-1s",
    "100000s",
    123,
    null,
  ]) {
    await assert.rejects(
      provisionRuntime("postgresql://invalid", "a".repeat(64), {
        lockTimeout: invalidTimeout,
      }),
      (err) => err.message === "INVALID_TIMEOUT_FORMAT",
      `Expected lockTimeout ${invalidTimeout} to throw INVALID_TIMEOUT_FORMAT`,
    );
    await assert.rejects(
      provisionRuntime("postgresql://invalid", "a".repeat(64), {
        statementTimeout: invalidTimeout,
      }),
      (err) => err.message === "INVALID_TIMEOUT_FORMAT",
      `Expected statementTimeout ${invalidTimeout} to throw INVALID_TIMEOUT_FORMAT`,
    );
  }
});

test("provisionRuntime validates maxAttempts fail-closed", async () => {
  for (const invalid of [
    0,
    -1,
    -5,
    1.5,
    NaN,
    Infinity,
    -Infinity,
    "5",
    null,
    {},
    [],
  ]) {
    await assert.rejects(
      provisionRuntime("postgresql://invalid", "a".repeat(64), {
        maxAttempts: invalid,
      }),
      (err) => err.message === "INVALID_RETRY_CONFIG",
      `Expected maxAttempts=${invalid} to throw INVALID_RETRY_CONFIG`,
    );
  }
  // Unreasonably large retry count
  await assert.rejects(
    provisionRuntime("postgresql://invalid", "a".repeat(64), {
      maxAttempts: 25,
    }),
    (err) => err.message === "INVALID_RETRY_CONFIG",
  );
});

test("provisionRuntime does not leak secret password or admin credentials in error output", async () => {
  const runtimeSecret = "f".repeat(64);
  const adminSecret = "super_admin_secret_marker_789xyz";
  const adminUrl = `postgresql://nexora:${adminSecret}@127.0.0.1:59999/nexora`;
  try {
    // Non-existent port fails closed immediately
    await provisionRuntime(adminUrl, runtimeSecret, { maxAttempts: 1 });
    assert.fail("should have thrown");
  } catch (err) {
    assert.equal(err.message, "DATABASE_RUNTIME_PROVISION_FAILED");
    const errorStrings = [
      err.message,
      err.stack || "",
      String(err),
      err.cause?.message || "",
      err.cause?.stack || "",
      JSON.stringify(err),
    ];
    for (const str of errorStrings) {
      assert.ok(
        !str.includes(runtimeSecret),
        "Error output must never leak the runtime secret password",
      );
      assert.ok(
        !str.includes(adminSecret),
        "Error output must never leak the administrative password",
      );
    }
  }
});
