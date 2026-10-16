// Test-only real enrollment and login helper. No production fallback or fake session.
const { randomBytes } = require("node:crypto");
const { SecretCipher } = require("../../dist/common/crypto/secret-cipher");
const {
  EnvironmentKeyring,
} = require("../../dist/common/crypto/environment-keyring");
const {
  IdentityMfaAdapter,
} = require("../../dist/identity/infrastructure/mfa.adapter");
const { AuthService } = require("../../dist/identity/application/auth.service");
const { MfaService } = require("../../dist/identity/application/mfa.service");
const {
  generateTotpSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} = require("../../dist/identity/infrastructure/totp");
const records = new Map();
const key = randomBytes(32).toString("base64");
function configureMfa() {
  process.env.IDENTITY_KEYRING_JSON = JSON.stringify({ 1: key });
  process.env.IDENTITY_ACTIVE_KEY_VERSION = "1";
}
async function loginWithMfa(identity, username, password) {
  const user = await identity.findUserByUsername(username);
  if (user?.role !== "ADMIN")
    return new AuthService(identity).login(username, password);
  configureMfa();
  const adapter = new IdentityMfaAdapter(
    identity.url,
    new SecretCipher(new EnvironmentKeyring(process.env, "IDENTITY")),
  );
  try {
    const id = identity.url + user.id;
    if (!records.has(id)) {
      const verified = await adapter.enrollmentIdentity(username, password),
        secret = generateTotpSecret(),
        codes = generateRecoveryCodes();
      try {
        await adapter.enroll(
          verified.id,
          verified.passwordHash,
          secret,
          Math.floor(Date.now() / 30000) - 1,
          codes.map(hashRecoveryCode),
        );
      } finally {
        secret.fill(0);
      }
      records.set(id, codes);
    }
    const codes = records.get(id);
    if (!codes.length) throw Error("Test MFA recovery fixture exhausted");
    const auth = new AuthService(identity, Date.now, adapter),
      challenge = await auth.login(username, password);
    return new MfaService(adapter, auth).verify(challenge.challengeToken, {
      type: "recovery",
      code: codes.shift(),
    });
  } finally {
    await adapter.onApplicationShutdown();
  }
}
module.exports = { loginWithMfa, configureMfa };
