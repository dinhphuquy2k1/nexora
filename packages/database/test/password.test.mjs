import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../dist/password.js";

test("hashPassword generates valid scrypt format with unique salts", async () => {
  const hash1 = await hashPassword("superSecret123");
  const hash2 = await hashPassword("superSecret123");

  assert.match(
    hash1,
    /^\$scrypt\$N=16384,r=8,p=1\$[a-f0-9]{32}\$[a-f0-9]{128}$/,
    "hash format must match $scrypt$N=...,r=...,p=...$<salt>$<key>",
  );
  assert.notEqual(
    hash1,
    hash2,
    "two hashes of the same password must have different salts",
  );
});

test("verifyPassword correctly checks passwords against hash", async () => {
  const password = "correct-horse-battery-staple";
  const hash = await hashPassword(password);

  const isMatch = await verifyPassword(password, hash);
  assert.equal(isMatch, true, "correct password must verify successfully");

  const isWrong = await verifyPassword("wrong-password", hash);
  assert.equal(isWrong, false, "incorrect password must fail verification");

  const isMalformed = await verifyPassword(password, "invalid-hash-string");
  assert.equal(isMalformed, false, "malformed hash must return false safely");
});
