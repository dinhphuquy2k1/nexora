const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  totpAt,
  matchTotpStep,
  generateTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} = require("../dist/identity/infrastructure/totp");
test("RFC6238 SHA1 vectors truncated to six digits, including leading zero", () => {
  const secret = Buffer.from("12345678901234567890");
  for (const [seconds, expected] of [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ])
    assert.equal(totpAt(secret, Math.floor(seconds / 30)), expected);
});
test("TOTP exact ±1 window, string validation and monotonic replay evidence", () => {
  const secret = Buffer.alloc(20, 7),
    step = 1000;
  for (const offset of [-1, 0, 1])
    assert.equal(
      matchTotpStep(secret, totpAt(secret, step + offset), step * 30000),
      step + offset,
    );
  for (const offset of [-2, 2])
    assert.equal(
      matchTotpStep(secret, totpAt(secret, step + offset), step * 30000),
      null,
    );
  for (const code of [
    123456,
    "12345",
    "1234567",
    "１２３４５６",
    " 123456",
    null,
  ])
    assert.equal(matchTotpStep(secret, code, step * 30000), null);
});
test("secrets and ten recovery codes use independent CSPRNG entropy and canonical hashes", () => {
  const a = generateTotpSecret(),
    b = generateTotpSecret();
  assert.equal(a.length, 20);
  assert.notDeepEqual(a, b);
  const codes = generateRecoveryCodes();
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const c of codes) {
    assert.match(c, /^[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);
    assert.match(hashRecoveryCode(c), /^[a-f0-9]{64}$/);
    assert.equal(hashRecoveryCode(c.toLowerCase()), hashRecoveryCode(c));
  }
  assert.equal(hashRecoveryCode("bad"), null);
});
