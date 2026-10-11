import test from "node:test";
import assert from "node:assert/strict";
import { resolveStatusTone } from "../src/status-tone.ts";

test("resolveStatusTone maps boolean and null states accurately", () => {
  assert.equal(resolveStatusTone(true), "good", "true must resolve to good");
  assert.equal(resolveStatusTone(false), "bad", "false must resolve to bad");
  assert.equal(
    resolveStatusTone(null),
    "pending",
    "null must resolve to pending",
  );
  assert.equal(
    resolveStatusTone(undefined),
    "pending",
    "undefined must resolve to pending",
  );
});
