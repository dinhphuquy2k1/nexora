const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const {
  SecretCipher,
  CryptoFailure,
} = require("../dist/common/crypto/secret-cipher");
const ring = new Map([
  [1, randomBytes(32)],
  [2, randomBytes(32)],
]);
const keys = (active = 1, values = ring) => ({
  activeVersion: () => active,
  key: (v) => {
    if (!values.has(v)) throw new CryptoFailure();
    return values.get(v);
  },
});
const aad = "connection:user:uniship:ACCESS_TOKEN";
test("AES-GCM roundtrip, nonce uniqueness and purpose separation", () => {
  const c = new SecretCipher(keys());
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const e = c.encrypt("CARRIER_TOKEN", aad, "private-value");
    assert.equal(c.decrypt("CARRIER_TOKEN", aad, e), "private-value");
    assert.equal(Buffer.from(e.nonce, "base64").length, 12);
    seen.add(e.nonce);
    assert.ok(!JSON.stringify(e).includes("private-value"));
    assert.throws(() => c.decrypt("CARRIER_PASSWORD", aad, e), CryptoFailure);
  }
  assert.equal(seen.size, 100);
});
test("AAD/user/connection/type swaps and every encrypted component fail closed", () => {
  const c = new SecretCipher(keys()),
    e = c.encrypt("CARRIER_TOKEN", aad, "sensitive");
  for (const a of [
    "other:user:uniship:ACCESS_TOKEN",
    "connection:other:uniship:ACCESS_TOKEN",
    "connection:user:other:ACCESS_TOKEN",
    "connection:user:uniship:REFRESH_TOKEN",
  ])
    assert.throws(() => c.decrypt("CARRIER_TOKEN", a, e), CryptoFailure);
  for (const field of ["ciphertext", "nonce", "authTag"]) {
    const b = Buffer.from(e[field], "base64");
    b[0] ^= 1;
    assert.throws(
      () =>
        c.decrypt("CARRIER_TOKEN", aad, {
          ...e,
          [field]: b.toString("base64"),
        }),
      CryptoFailure,
    );
  }
  assert.throws(
    () =>
      new SecretCipher(keys(1, new Map([[1, randomBytes(32)]]))).decrypt(
        "CARRIER_TOKEN",
        aad,
        e,
      ),
    CryptoFailure,
  );
  assert.throws(
    () => c.decrypt("CARRIER_TOKEN", aad, { ...e, keyVersion: 99 }),
    CryptoFailure,
  );
  assert.throws(
    () => c.decrypt("CARRIER_TOKEN", aad, { ...e, ciphertext: "%%%" }),
    CryptoFailure,
  );
});
test("active key rotation preserves old reads and safely detects missing versions", () => {
  const old = new SecretCipher(keys()).encrypt("CARRIER_PASSWORD", aad, "old");
  const c = new SecretCipher(keys(2));
  assert.equal(c.decrypt("CARRIER_PASSWORD", aad, old), "old");
  assert.equal(c.encrypt("CARRIER_TOKEN", aad, "new").keyVersion, 2);
  assert.throws(
    () =>
      new SecretCipher(keys(2, new Map([[2, ring.get(2)]]))).decrypt(
        "CARRIER_PASSWORD",
        aad,
        old,
      ),
    CryptoFailure,
  );
});

const {
  EnvironmentKeyring,
} = require("../dist/common/crypto/environment-keyring");
test("keyring strict version/encoding validation is lazy and fails without revealing config", () => {
  const key = randomBytes(32).toString("base64");
  for (const env of [
    {},
    { CARRIER_KEYRING_JSON: "not-json", CARRIER_ACTIVE_KEY_VERSION: "1" },
    {
      CARRIER_KEYRING_JSON: JSON.stringify({ 1: "bad" }),
      CARRIER_ACTIVE_KEY_VERSION: "1",
    },
    {
      CARRIER_KEYRING_JSON: JSON.stringify({ 1: key }),
      CARRIER_ACTIVE_KEY_VERSION: "01",
    },
    {
      CARRIER_KEYRING_JSON: JSON.stringify({ 1: key }),
      CARRIER_ACTIVE_KEY_VERSION: "2",
    },
    {
      CARRIER_KEYRING_JSON: JSON.stringify({ "01": key }),
      CARRIER_ACTIVE_KEY_VERSION: "1",
    },
  ]) {
    const ring = new EnvironmentKeyring(env);
    assert.throws(
      () => ring.activeVersion(),
      (e) =>
        e instanceof CryptoFailure && e.message === "SECRET_CRYPTO_UNAVAILABLE",
    );
  }
  const env = {
    CARRIER_KEYRING_JSON: JSON.stringify({
      1: key,
      2: randomBytes(32).toString("base64"),
    }),
    CARRIER_ACTIVE_KEY_VERSION: "2",
  };
  const ring = new EnvironmentKeyring(env);
  env.CARRIER_ACTIVE_KEY_VERSION = "1";
  assert.equal(ring.activeVersion(), 2);
  assert.equal(ring.key(1).toString("base64"), key);
  assert.throws(() => ring.key(3), CryptoFailure);
});
