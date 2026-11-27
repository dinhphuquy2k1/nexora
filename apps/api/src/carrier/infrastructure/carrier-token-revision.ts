import { createHash } from "node:crypto";
import type { EncryptedSecret } from "../../common/crypto/secret-cipher";
/** Sealed artifact revision, never plaintext-derived or public metadata. */
export function carrierTokenRevision(token?: EncryptedSecret): string | null {
  return token
    ? createHash("sha256")
        .update(
          JSON.stringify([
            token.ciphertext,
            token.nonce,
            token.authTag,
            token.keyVersion,
          ]),
        )
        .digest("hex")
    : null;
}
