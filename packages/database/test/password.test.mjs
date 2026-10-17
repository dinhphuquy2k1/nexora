import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/password.ts";

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

test("malformed stored hashes fail closed before scrypt", async () => {
  const hash = await hashPassword("correct-password");
  const [, algorithm, params, salt, key] = hash.split("$");
  const encode = (p = params, s = salt, k = key) =>
    `$${algorithm}$${p}$${s}$${k}`;
  const malformed = [
    "$scrypt$N=16384,r=8,p=1$00$",
    "$scrypt$N=16384,r=8,p=1$00$zz",
    encode(params, salt, ""),
    encode(params, salt, "zz"),
    encode(params, salt, key.slice(1)),
    encode(params, salt, key.slice(2)),
    encode(params, salt.slice(1)),
    encode(params, salt.slice(2)),
    encode(params, ""),
    encode(params, "zz"),
    hash + "$extra",
    hash + "\n",
    hash.slice(1),
    hash.split("$").slice(0, 4).join("$"),
    ...[
      "N=16384oops,r=8,p=1",
      "N=16384,r=8,p=1,p=1",
      "r=8,p=1",
      "N=0,r=8,p=1",
      "N=-1,r=8,p=1",
      "N=16384,r=0,p=1",
      "N=16384,r=8,p=0",
      "N=16384,r=8,p=1,unknown=1",
      "N=16384,r=8,p=1=extra",
      "N=16384,r=8,p=1.0",
      "N=32768,r=8,p=1",
    ].map((p) => encode(p)),
  ];
  for (const stored of malformed) {
    assert.equal(
      await verifyPassword("arbitrary-wrong-password", stored),
      false,
    );
    assert.equal(await verifyPassword("correct-password", stored), false);
  }
});
