import { carrierTokenRevision } from "./carrier-token-revision";
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
import { getDefaultSyncPolicies } from "../domain/default-sync-policy";
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
    // Lock user row first to maintain user -> connection lock ordering against disablement.
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM users
      WHERE id = ${userId}::uuid
      FOR UPDATE
    `;
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
    // Lock target connection row after user lock to serialize lifecycle transitions.
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM carrier_connections
      WHERE id = ${id}::uuid
        AND user_id = ${userId}::uuid
      FOR UPDATE
    `;
    if (!rows.length) throw new LifecycleFailure(LifecycleCode.NOT_FOUND);
    return tx.carrierConnection.findUniqueOrThrow({
      where: { id },
      select: { ...metadata, lifecycleVersion: true },
    });
  }
  async authorizeNew(userId: string) {
    return this.client.$transaction((tx) => this.active(tx, userId));
  }
  async read(userId: string, id: string): Promise<LifecycleSnapshot> {
    const { token, ...snapshot } = await this.client.$transaction(
      async (tx) => {
        const generation = await this.active(tx, userId),
          row = await this.locked(tx, userId, id);
        const { lifecycleVersion, ...connection } = row;
        const token = await this.secret(tx, id, SecretType.ACCESS_TOKEN);
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
    return {
      ...snapshot,
      tokenRevision: carrierTokenRevision(token ?? undefined),
    };
  }
  async claim(
    userId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<LifecycleSnapshot> {
    return this.claimLocked(userId, id, expectedVersion);
  }
  async claimReconnect(
    userId: string,
    id: string,
    expected: Pick<LifecycleSnapshot, "generation" | "version">,
  ): Promise<LifecycleSnapshot> {
    return this.claimLocked(userId, id, expected.version, expected.generation);
  }
  private async claimLocked(
    userId: string,
    id: string,
    expectedVersion?: number,
    expectedGeneration?: number,
  ): Promise<LifecycleSnapshot> {
    const { token, ...snapshot } = await this.client.$transaction(
      async (tx) => {
        const generation = await this.active(tx, userId),
          row = await this.locked(tx, userId, id);
        if (
          expectedVersion !== undefined &&
          (row.lifecycleVersion !== expectedVersion ||
            (expectedGeneration === undefined &&
              row.status === ConnectionStatus.REAUTH_REQUIRED) ||
            (expectedGeneration !== undefined &&
              generation !== expectedGeneration))
        )
          throw new LifecycleFailure(LifecycleCode.STALE);
        const { lifecycleVersion, ...connection } = row;
        await tx.carrierConnection.update({
          where: { id },
          data: { lifecycleVersion: { increment: 1 } },
        });
        const token = await this.secret(tx, id, SecretType.ACCESS_TOKEN);
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
    return {
      ...snapshot,
      tokenRevision: carrierTokenRevision(token ?? undefined),
    };
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
        for (const policy of getDefaultSyncPolicies(connection.provider)) {
          await tx.syncConfig.create({
            data: {
              carrier_connection_id: connection.id,
              sync_type: policy.syncType,
              enabled: policy.enabled,
              interval_minutes: policy.intervalMinutes,
              // DB-created TIMESTAMPTZ(3) and JS Date both retain exact milliseconds.
              next_run_at: new Date(
                connection.createdAt.getTime() +
                  policy.intervalMinutes * 60_000,
              ),
            },
          });
        }
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
  private secret(
    tx: Prisma.TransactionClient,
    connectionId: string,
    secretType: SecretType,
  ) {
    return tx.carrierConnectionSecret.findUnique({
      where: { connectionId_secretType: { connectionId, secretType } },
      select: {
        ciphertext: true,
        nonce: true,
        authTag: true,
        keyVersion: true,
        expiresAt: true,
      },
    });
  }
  private async authorized(
    tx: Prisma.TransactionClient,
    userId: string,
    snapshot: LifecycleSnapshot,
  ) {
    const generation = await this.active(tx, userId);
    const row = await this.locked(tx, userId, snapshot.connection.id);
    if (
      generation !== snapshot.generation ||
      row.lifecycleVersion !== snapshot.version
    )
      throw new LifecycleFailure(LifecycleCode.STALE);
    if (row.status === ConnectionStatus.REAUTH_REQUIRED)
      throw new LifecycleFailure(LifecycleCode.REAUTH_REQUIRED);
    return row;
  }
  async authorizeRecovery(
    userId: string,
    snapshot: LifecycleSnapshot,
  ): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await this.authorized(tx, userId, snapshot);
    });
  }
  async loadToken(userId: string, snapshot: LifecycleSnapshot) {
    return this.client.$transaction(async (tx) => {
      const row = await this.authorized(tx, userId, snapshot);
      return {
        token:
          (await this.secret(tx, row.id, SecretType.ACCESS_TOKEN)) ?? undefined,
      };
    });
  }
  async loadRecoveryPassword(userId: string, snapshot: LifecycleSnapshot) {
    return this.client.$transaction(async (tx) => {
      const row = await this.authorized(tx, userId, snapshot);
      return {
        loginIdentifier: row.loginIdentifier,
        password:
          (await this.secret(tx, row.id, SecretType.PASSWORD)) ?? undefined,
      };
    });
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
