import { createHash } from "node:crypto";
import type { EncryptedSecret } from "../../common/crypto/secret-cipher";
import {
  createDatabase,
  type Prisma,
  type PrismaClient,
} from "@nexora/database";
import { UserStatus } from "../../identity/domain/user-policy";
import {
  CarrierLifecyclePort,
  type LifecycleSnapshot,
  type SealedCandidate,
} from "../application/carrier-lifecycle.port";
import {
  CarrierProvider,
  ConnectionStatus,
  SecretType,
} from "../domain/carrier";
import { LifecycleCode, LifecycleFailure } from "../domain/lifecycle";
import {
  CarrierAuditType,
  CarrierAuditOutcome,
  CarrierAuditReason,
} from "../domain/security-audit";
import { PostgresSecurityAudit } from "./security-audit.adapter";
import type { AuthorizedCredentialReader } from "./carrier-credential-vault";
const metadata = {
  id: true,
  provider: true,
  externalAccountId: true,
  loginIdentifier: true,
  displayName: true,
  status: true,
  lastVerifiedAt: true,
  createdAt: true,
} as const;
export class CarrierLifecycleAdapter
  extends CarrierLifecyclePort
  implements AuthorizedCredentialReader
{
  private instance?: PrismaClient;
  constructor(private readonly url: string) {
    super();
  }
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  private async active(tx: Prisma.TransactionClient, userId: string) {
    const rows = await tx.$queryRaw<
      Array<{ status: string }>
    >`SELECT status FROM users WHERE id=${userId}::uuid FOR UPDATE`;
    if (rows[0]?.status !== UserStatus.ACTIVE)
      throw new LifecycleFailure(LifecycleCode.UNAUTHORIZED);
    return (
      await tx.carrierUserState.upsert({
        where: { userId },
        create: { userId },
        update: {},
      })
    ).generation;
  }
  private async locked(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
  ) {
    const rows = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM carrier_connections WHERE id=${id}::uuid AND user_id=${userId}::uuid FOR UPDATE`;
    if (!rows.length) throw new LifecycleFailure(LifecycleCode.NOT_FOUND);
    return tx.carrierConnection.findUniqueOrThrow({
      where: { id },
      select: { ...metadata, lifecycleVersion: true, secrets: true },
    });
  }
  private tokenRevision(token?: EncryptedSecret): string | null {
    // Unlike timestamps/row IDs, the sealed artifact identifies actual token writes.
    // Do not decrypt, log, audit or expose this internal ciphertext digest.
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
  async authorizeNew(userId: string) {
    return this.client.$transaction((tx) => this.active(tx, userId));
  }
  async read(userId: string, id: string): Promise<LifecycleSnapshot> {
    const { token, ...snapshot } = await this.client.$transaction(
      async (tx) => {
        const generation = await this.active(tx, userId),
          row = await this.locked(tx, userId, id);
        const { lifecycleVersion, secrets, ...connection } = row;
        const token = secrets.find(
          (secret) => secret.secretType === SecretType.ACCESS_TOKEN,
        );
        return {
          connection,
          generation,
          version: lifecycleVersion,
          hasToken: !!token,
          token,
          expiresAt: token?.expiresAt ?? null,
        };
      },
    );
    // Derive the internal revision after releasing database locks.
    return { ...snapshot, tokenRevision: this.tokenRevision(token) };
  }
  async claim(
    userId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<LifecycleSnapshot> {
    const { token, ...snapshot } = await this.client.$transaction(
      async (tx) => {
        const generation = await this.active(tx, userId),
          row = await this.locked(tx, userId, id);
        if (
          expectedVersion !== undefined &&
          (row.lifecycleVersion !== expectedVersion ||
            row.status === ConnectionStatus.REAUTH_REQUIRED)
        )
          throw new LifecycleFailure(LifecycleCode.STALE);
        const { lifecycleVersion, secrets, ...connection } = row;
        await tx.carrierConnection.update({
          where: { id },
          data: { lifecycleVersion: { increment: 1 } },
        });
        const token = secrets.find(
          (secret) => secret.secretType === SecretType.ACCESS_TOKEN,
        );
        return {
          connection,
          generation,
          version: lifecycleVersion + 1,
          hasToken: !!token,
          token,
          expiresAt: token?.expiresAt ?? null,
        };
      },
    );
    // Derive the internal revision after releasing database locks.
    return { ...snapshot, tokenRevision: this.tokenRevision(token) };
  }
  private async secrets(
    tx: Prisma.TransactionClient,
    id: string,
    candidate: SealedCandidate,
  ) {
    for (const [secretType, sealed, expiresAt] of [
      [SecretType.PASSWORD, candidate.password, null],
      [SecretType.ACCESS_TOKEN, candidate.token, candidate.expiresAt],
    ] as const) {
      const data = { ...sealed, expiresAt };
      await tx.carrierConnectionSecret.upsert({
        where: { connectionId_secretType: { connectionId: id, secretType } },
        create: { connectionId: id, secretType, ...data },
        update: data,
      });
    }
  }
  async create(
    userId: string,
    id: string,
    generation: number,
    loginIdentifier: string,
    displayName: string,
    candidate: SealedCandidate,
    correlationId: string,
  ) {
    try {
      return await this.client.$transaction(async (tx) => {
        if ((await this.active(tx, userId)) !== generation)
          throw new LifecycleFailure(LifecycleCode.STALE);
        const connection = await tx.carrierConnection.create({
          data: {
            id,
            userId,
            provider: CarrierProvider.UNISHIP,
            externalAccountId: candidate.externalAccountId,
            loginIdentifier,
            displayName,
            status: ConnectionStatus.CONNECTED,
            lastVerifiedAt: new Date(),
          },
          select: metadata,
        });
        await this.secrets(tx, id, candidate);
        await PostgresSecurityAudit.insert(tx, {
          eventType: CarrierAuditType.CONNECT,
          outcome: CarrierAuditOutcome.SUCCESS,
          reason: CarrierAuditReason.VERIFIED,
          userId,
          connectionId: id,
          provider: CarrierProvider.UNISHIP,
          correlationId,
        });
        return connection;
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new LifecycleFailure(LifecycleCode.DUPLICATE);
      throw error;
    }
  }
  async complete(
    userId: string,
    snapshot: LifecycleSnapshot,
    candidate: SealedCandidate,
    correlationId: string,
    eventType: CarrierAuditType = CarrierAuditType.RECONNECT,
  ) {
    return this.client.$transaction(async (tx) => {
      const generation = await this.active(tx, userId),
        row = await this.locked(tx, userId, snapshot.connection.id);
      if (
        generation !== snapshot.generation ||
        row.lifecycleVersion !== snapshot.version
      )
        throw new LifecycleFailure(LifecycleCode.STALE);
      if (row.externalAccountId !== candidate.externalAccountId)
        throw new LifecycleFailure(LifecycleCode.IDENTITY_MISMATCH);
      await this.secrets(tx, row.id, candidate);
      const connection = await tx.carrierConnection.update({
        where: { id: row.id },
        data: {
          status: ConnectionStatus.CONNECTED,
          lastVerifiedAt: new Date(),
          lifecycleVersion: { increment: 1 },
        },
        select: metadata,
      });
      await PostgresSecurityAudit.insert(tx, {
        eventType,
        outcome: CarrierAuditOutcome.SUCCESS,
        reason: CarrierAuditReason.VERIFIED,
        userId,
        connectionId: row.id,
        provider: CarrierProvider.UNISHIP,
        correlationId,
      });
      return connection;
    });
  }
  async fail(
    userId: string,
    snapshot: LifecycleSnapshot,
    status: ConnectionStatus,
  ) {
    try {
      await this.client.$transaction(async (tx) => {
        if ((await this.active(tx, userId)) !== snapshot.generation) return;
        await tx.carrierConnection.updateMany({
          where: {
            id: snapshot.connection.id,
            userId,
            lifecycleVersion: snapshot.version,
          },
          data: { status, lifecycleVersion: { increment: 1 } },
        });
      });
    } catch (error) {
      if (
        error instanceof LifecycleFailure &&
        error.code === LifecycleCode.UNAUTHORIZED
      )
        return;
      throw error;
    }
  }
  async load(userId: string, snapshot: LifecycleSnapshot) {
    return this.client.$transaction(async (tx) => {
      const generation = await this.active(tx, userId),
        row = await this.locked(tx, userId, snapshot.connection.id);
      if (
        generation !== snapshot.generation ||
        row.lifecycleVersion !== snapshot.version
      )
        throw new LifecycleFailure(LifecycleCode.STALE);
      if (row.status === ConnectionStatus.REAUTH_REQUIRED)
        throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
      return {
        loginIdentifier: row.loginIdentifier,
        password: row.secrets.find(
          (secret) => secret.secretType === SecretType.PASSWORD,
        ),
        token: row.secrets.find(
          (secret) => secret.secretType === SecretType.ACCESS_TOKEN,
        ),
      };
    });
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
