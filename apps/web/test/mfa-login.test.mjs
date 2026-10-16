import { test } from "node:test";
import assert from "node:assert/strict";
import { loginOutcome } from "../lib/auth/login-outcome.ts";
test("only a real session result permits workspace navigation; MFA remains pending", () => {
  assert.equal(loginOutcome({ mfaRequired: true }), "mfa");
  assert.equal(
    loginOutcome({ user: { id: "id", username: "operator" } }),
    "session",
  );
  for (const body of [
    null,
    {},
    { mfaRequired: false },
    { user: null },
    { user: { id: "", username: "admin" } },
    { mfaRequired: true, user: { id: "id", username: "admin" } },
  ])
    assert.equal(loginOutcome(body), "invalid");
});
