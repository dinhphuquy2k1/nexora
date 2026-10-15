import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

export class CryptoFailure extends Error {
  constructor() {
    super("SECRET_CRYPTO_UNAVAILABLE");
  }
}
export type CryptoPurpose = "CARRIER_TOKEN" | "CARRIER_PASSWORD";
export interface KeyProvider {
  activeVersion(): number;
  key(version: number): Buffer;
}
export interface EncryptedSecret {
  ciphertext: string;
  nonce: string;
  authTag: string;
  keyVersion: number;
}
function decode(value: string, length?: number): Buffer {
  if (typeof value !== "string") throw new CryptoFailure();
  const bytes = Buffer.from(value, "base64");
  if (
    bytes.toString("base64") !== value ||
    (length !== undefined && bytes.length !== length)
  )
    throw new CryptoFailure();
  return bytes;
}
/** Generic primitive. Carrier production code deliberately has no password reader. */
export class SecretCipher {
  constructor(private readonly keys: KeyProvider) {}
  private subkey(version: number, purpose: CryptoPurpose): Buffer {
    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      !["CARRIER_TOKEN", "CARRIER_PASSWORD"].includes(purpose)
    )
      throw new CryptoFailure();
    const master = this.keys.key(version);
    if (master.length !== 32) throw new CryptoFailure();
    return Buffer.from(
      hkdfSync(
        "sha256",
        master,
        Buffer.from("NEXORA_CARRIER_V1"),
        Buffer.from(purpose),
        32,
      ),
    );
  }
  encrypt(
    purpose: CryptoPurpose,
    aad: string,
    plaintext: string,
  ): EncryptedSecret {
    let key: Buffer | undefined;
    try {
      const keyVersion = this.keys.activeVersion();
      key = this.subkey(keyVersion, purpose);
      const nonce = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, nonce, {
        authTagLength: 16,
      });
      cipher.setAAD(Buffer.from(aad, "utf8"));
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      return {
        ciphertext: ciphertext.toString("base64"),
        nonce: nonce.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        keyVersion,
      };
    } catch {
      throw new CryptoFailure();
    } finally {
      key?.fill(0);
    }
  }
  decrypt(
    purpose: CryptoPurpose,
    aad: string,
    secret: EncryptedSecret,
  ): string {
    let key: Buffer | undefined,
      partial: Buffer | undefined,
      final: Buffer | undefined;
    try {
      key = this.subkey(secret.keyVersion, purpose);
      const cipher = createDecipheriv(
        "aes-256-gcm",
        key,
        decode(secret.nonce, 12),
        { authTagLength: 16 },
      );
      cipher.setAAD(Buffer.from(aad, "utf8"));
      cipher.setAuthTag(decode(secret.authTag, 16));
      partial = cipher.update(decode(secret.ciphertext));
      final = cipher.final(); // Never expose partial plaintext before authentication.
      return Buffer.concat([partial, final]).toString("utf8");
    } catch {
      throw new CryptoFailure();
    } finally {
      key?.fill(0);
      partial?.fill(0);
      final?.fill(0);
    }
  }
}
