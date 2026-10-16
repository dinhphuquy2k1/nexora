const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  EnvironmentKeyring,
} = require("../dist/common/crypto/environment-keyring");
const { SecretCipher } = require("../dist/common/crypto/secret-cipher");
test("Identity key custody is isolated, versioned, purpose/AAD authenticated and fail closed", () => {
  const one = Buffer.alloc(32, 12).toString("base64"),
    two = Buffer.alloc(32, 13).toString("base64");
  const env = {
    IDENTITY_KEYRING_JSON: JSON.stringify({ 1: one, 2: two }),
    IDENTITY_ACTIVE_KEY_VERSION: "1",
  };
  const cipher = new SecretCipher(new EnvironmentKeyring(env, "IDENTITY"));
  const aad = "v1:owner:IDENTITY_TOTP",
    sealed = cipher.encrypt("IDENTITY_TOTP", aad, "synthetic");
  assert.equal(cipher.decrypt("IDENTITY_TOTP", aad, sealed), "synthetic");
  const rotated = new SecretCipher(
    new EnvironmentKeyring(
      { ...env, IDENTITY_ACTIVE_KEY_VERSION: "2" },
      "IDENTITY",
    ),
  );
  assert.equal(rotated.decrypt("IDENTITY_TOTP", aad, sealed), "synthetic");
  assert.equal(
    rotated.encrypt("IDENTITY_TOTP", aad, "synthetic").keyVersion,
    2,
  );
  assert.throws(() =>
    cipher.decrypt("IDENTITY_TOTP", "v1:other:IDENTITY_TOTP", sealed),
  );
  assert.throws(() => cipher.decrypt("CARRIER_TOKEN", aad, sealed));
  assert.throws(() =>
    cipher.decrypt("IDENTITY_TOTP", aad, {
      ...sealed,
      authTag: Buffer.alloc(16).toString("base64"),
    }),
  );
  assert.throws(() =>
    new SecretCipher(
      new EnvironmentKeyring(
        {
          CARRIER_KEYRING_JSON: env.IDENTITY_KEYRING_JSON,
          CARRIER_ACTIVE_KEY_VERSION: "1",
        },
        "IDENTITY",
      ),
    ).encrypt("IDENTITY_TOTP", aad, "synthetic"),
  );
  for (const key of [undefined, "{}", '{"1":"bad"}'])
    assert.throws(() =>
      new SecretCipher(
        new EnvironmentKeyring(
          { ...env, IDENTITY_KEYRING_JSON: key },
          "IDENTITY",
        ),
      ).encrypt("IDENTITY_TOTP", aad, "synthetic"),
    );
});
