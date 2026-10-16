import { UserStatus } from "../../identity/domain/user-policy";
import type { PrismaClient } from "@nexora/database";
import { SecretCipher } from "../../common/crypto/secret-cipher";
import { CarrierError, ConnectionStatus, SecretType } from "../domain/carrier";

/** Internal only; never registered as a controller or exposes a decryption method.
 * Provider verification/acquisition and durable audit orchestration belong to PR4.
 */
export class CarrierSecretWriter {
  constructor(
    private readonly db: PrismaClient,
    private readonly cipher: SecretCipher,
  ) {}
  async write(
    userId: string,
    connectionId: string,
    secretType: SecretType,
    plaintext: string,
    expiresAt: Date | null = null,
  ) {
    if (!Object.values(SecretType).includes(secretType))
      throw new CarrierError("NOT_FOUND");
    userId = userId.toLowerCase();
    connectionId = connectionId.toLowerCase();
    const connection = await this.db.carrierConnection.findFirst({
      where: { id: connectionId, userId },
      select: { provider: true, lifecycleVersion: true },
    });
    if (!connection) throw new CarrierError("NOT_FOUND");
    const aad = `${connectionId}:${userId}:${connection.provider}:${secretType}`;
    const purpose =
      secretType === SecretType.PASSWORD ? "CARRIER_PASSWORD" : "CARRIER_TOKEN";
    // All crypto finishes before transaction/row locks. A late result must recheck owner.
    const encrypted = this.cipher.encrypt(purpose, aad, plaintext);
    await this.db.$transaction(async (tx) => {
      const users = await tx.$queryRaw<
        Array<{ status: string }>
      >`SELECT status FROM users WHERE id=${userId}::uuid FOR UPDATE`;
      if (users[0]?.status !== UserStatus.ACTIVE)
        throw new CarrierError("UNAUTHORIZED");
      const rows = await tx.$queryRaw<
        Array<{ provider: string; lifecycle_version: number; status: string }>
      >`SELECT provider,lifecycle_version,status FROM carrier_connections WHERE id=${connectionId}::uuid AND user_id=${userId}::uuid FOR UPDATE`;
      if (
        rows[0]?.provider !== connection.provider ||
        rows[0].lifecycle_version !== connection.lifecycleVersion ||
        rows[0].status === ConnectionStatus.REAUTH_REQUIRED
      )
        throw new CarrierError("NOT_FOUND");
      await tx.carrierConnection.update({
        where: { id: connectionId },
        data: { lifecycleVersion: { increment: 1 } },
      });
      const data = { ...encrypted, expiresAt };
      await tx.carrierConnectionSecret.upsert({
        where: { connectionId_secretType: { connectionId, secretType } },
        create: { connectionId, secretType, ...data },
        update: data,
      });
    });
  }
}
