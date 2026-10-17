// Test-only: fed over stdin into the owned API container. No production backup subsystem.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { createDatabase } = require("@nexora/database");
const { SecretCipher } = require("./dist/common/crypto/secret-cipher");
const {
  EnvironmentKeyring,
} = require("./dist/common/crypto/environment-keyring");
const { LocalStorage } = require("./dist/storage/infrastructure/local-storage");
const db = createDatabase(process.env.DATABASE_URL),
  root = process.argv[3] || "/data/uploads",
  cipher = new SecretCipher(new EnvironmentKeyring(process.env));
const plaintext =
  "Synthetic HTTPS persistence token, never a provider credential";
(async () => {
  try {
    if (process.argv[2] === "seed") {
      const user = await db.user.findUnique({
        where: { username: "browser_user" },
      });
      const connectionId = "11111111-1111-4111-8111-111111111111";
      const sealed = cipher.encrypt(
        "CARRIER_TOKEN",
        `${connectionId}:${user.id}:uniship:ACCESS_TOKEN`,
        plaintext,
      );
      await db.carrierConnection.create({
        data: {
          id: connectionId,
          userId: user.id,
          provider: "uniship",
          externalAccountId: "https-owned-synthetic-fixture",
          displayName: "HTTPS owned fixture",
          status: "CONNECTED",
          secrets: { create: { secretType: "ACCESS_TOKEN", ...sealed } },
        },
      });
      const blob = await new LocalStorage(root).put(
        Buffer.from("Original owned HTTPS storage bytes"),
      );
      await db.storedFile.create({ data: blob });
      await fs.writeFile(
        root + "/.https-test-manifest.json",
        JSON.stringify({ fileId: blob.id, connectionId }),
        { mode: 0o600 },
      );
    } else {
      const manifest = JSON.parse(
        await fs.readFile(root + "/.https-test-manifest.json", "utf8"),
      );
      assert.ok(
        await db.storedFile.findUnique({ where: { id: manifest.fileId } }),
      );
      assert.equal(
        (await new LocalStorage(root).read(manifest.fileId)).toString(),
        "Original owned HTTPS storage bytes",
      );
      const connection = await db.carrierConnection.findUnique({
        where: { id: manifest.connectionId },
        include: { secrets: true },
      });
      assert.equal(
        cipher.decrypt(
          "CARRIER_TOKEN",
          `${connection.id}:${connection.userId}:uniship:ACCESS_TOKEN`,
          connection.secrets[0],
        ),
        plaintext,
      );
    }
    console.log(
      "Owned HTTPS file/catalog and encrypted Carrier persistence PASS",
    );
  } finally {
    await db.$disconnect();
  }
})().catch(() => {
  console.error("Owned HTTPS persistence fixture failed");
  process.exitCode = 1;
});
