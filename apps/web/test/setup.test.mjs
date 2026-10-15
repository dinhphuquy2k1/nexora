import test from "node:test";
import assert from "node:assert/strict";
import { takeSetupToken } from "../lib/auth/setup.ts";
test("setup reads only fragment, clears history before use and never persists token", () => {
  const secret = "a".repeat(64),
    calls = [];
  const token = takeSetupToken(
    { hash: "#token=" + secret, pathname: "/setup", search: "" },
    { replaceState: (...args) => calls.push(args) },
  );
  assert.equal(token, secret);
  assert.deepEqual(calls, [[null, "", "/setup"]]);
  assert.equal(
    takeSetupToken(
      { hash: "", pathname: "/setup", search: "?token=" + secret },
      { replaceState: () => {} },
    ),
    null,
  );
  for (const hash of ["#token=bad", "#token=", "#other=" + secret]) {
    let cleared = false;
    assert.equal(
      takeSetupToken(
        { hash, pathname: "/setup", search: "" },
        {
          replaceState: () => {
            cleared = true;
          },
        },
      ),
      null,
    );
    assert.ok(cleared);
  }
});
