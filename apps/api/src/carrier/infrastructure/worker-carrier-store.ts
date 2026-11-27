import { buildCompleteWorkerRecoveryQuery } from "./queries/worker-carrier.queries";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import {
  createDatabase,
  type PrismaClient,
  type Prisma,
} from "@nexora/database";
import type { SyncJob } from "../../sync/application/sync.port";
import {
  CarrierLifecyclePort,
  type LifecycleSnapshot,
  type SealedCandidate,
} from "../application/carrier-lifecycle.port";
import type {
  AuthorizedCredentialReader,
  AuthorizedCredentials,
} from "./carrier-credential-vault";
import { LifecycleFailure, LifecycleCode } from "../domain/lifecycle";
import type { ConnectionMetadata, ConnectionStatus } from "../domain/carrier";
import { CarrierAuditType } from "../domain/security-audit";
import type { EncryptedSecret } from "../../common/crypto/secret-cipher";
import { carrierTokenRevision } from "./carrier-token-revision";
export interface WorkerCarrierExecution {
  readonly job: SyncJob;
  readonly operationToken: string;
}
type StoredSnapshot = {
  connection: Omit<ConnectionMetadata, "createdAt" | "lastVerifiedAt"> & {
    createdAt: string;
    lastVerifiedAt: string | null;
  };
  generation: number;
  version: number;
  hasToken: boolean;
  token: EncryptedSecret | null;
  expiresAt: string | null;
};
/** Fixed credential capabilities, not the API adapter and not a new recovery engine. */
export class WorkerCarrierStore
  extends CarrierLifecyclePort
  implements AuthorizedCredentialReader
{
  private readonly executions = new AsyncLocalStorage<WorkerCarrierExecution>();
  private instance?: PrismaClient;
  constructor(private readonly url: string) {
    super();
  }
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  withJob<T>(job: SyncJob, operation: () => Promise<T>): Promise<T> {
    return this.executions.run(
      Object.freeze({
        job: Object.freeze({ ...job }),
        operationToken: randomUUID(),
      }),
      operation,
    );
  }
  execution(): WorkerCarrierExecution {
    const value = this.executions.getStore();
    if (!value || !value.job.carrier_connection_id || !value.job.worker_id)
      throw new LifecycleFailure(LifecycleCode.STALE);
    return value;
  }
  private scope(userId: string, id: string) {
    const value = this.execution();
    if (
      userId !== value.job.owner_user_id ||
      id !== value.job.carrier_connection_id
    )
      throw new LifecycleFailure(LifecycleCode.STALE);
    return value;
  }
  private async result<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<{ result: T }[]>,
  ): Promise<T> {
    try {
      const rows = await this.client.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL lock_timeout='250ms'`;
          await tx.$executeRaw`SET LOCAL statement_timeout='1000ms'`;
          return operation(tx);
        },
        { timeout: 2000 },
      );
      if (rows.length !== 1) throw new LifecycleFailure(LifecycleCode.STALE);
      return rows[0].result;
    } catch (error) {
      const value = error as {
        code?: string;
        meta?: {
          code?: unknown;
          driverAdapterError?: { cause?: { originalCode?: unknown } };
        };
      };
      const code =
        value.meta?.code ?? value.meta?.driverAdapterError?.cause?.originalCode;
      if (
        value.code === "P2010" &&
        typeof code === "string" &&
        ["42501", "23503"].includes(code)
      )
        throw new LifecycleFailure(LifecycleCode.STALE);
      if (
        value.code === "P2028" ||
        (value.code === "P2010" && ["55P03", "57014"].includes(String(code)))
      )
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      throw error;
    }
  }
  private snapshot(value: StoredSnapshot): LifecycleSnapshot {
    return {
      connection: {
        ...value.connection,
        createdAt: new Date(value.connection.createdAt),
        lastVerifiedAt: value.connection.lastVerifiedAt
          ? new Date(value.connection.lastVerifiedAt)
          : null,
      },
      generation: value.generation,
      version: value.version,
      hasToken: value.hasToken,
      tokenRevision: carrierTokenRevision(value.token ?? undefined),
      expiresAt: value.expiresAt ? new Date(value.expiresAt) : null,
    };
  }
  async authorizeNew(): Promise<number> {
    throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
  }
  async create(): Promise<ConnectionMetadata> {
    throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
  }
  async read(userId: string, id: string): Promise<LifecycleSnapshot> {
    const { job, operationToken } = this.scope(userId, id);
    return this.snapshot(
      await this.result<StoredSnapshot>(
        (tx) =>
          tx.$queryRaw`
          SELECT
            public.sync_carrier_snapshot(${job.id}::uuid,
              ${job.worker_id}::uuid,
              ${job.lease_version},
              ${operationToken}::uuid) AS result
          `,
      ),
    );
  }
  async claim(
    userId: string,
    id: string,
    expectedVersion?: number,
  ): Promise<LifecycleSnapshot> {
    if (expectedVersion === undefined)
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    const { job, operationToken } = this.scope(userId, id);
    return this.snapshot(
      await this.result<StoredSnapshot>(
        (tx) =>
          tx.$queryRaw`
          SELECT
            public.sync_carrier_claim(${job.id}::uuid,
              ${job.worker_id}::uuid,
              ${job.lease_version},
              ${operationToken}::uuid,
              ${expectedVersion}) AS result
          `,
      ),
    );
  }
  async load(
    userId: string,
    snapshot: LifecycleSnapshot,
  ): Promise<AuthorizedCredentials> {
    const { job, operationToken } = this.scope(userId, snapshot.connection.id);
    const value = await this.result<AuthorizedCredentials>(
      (tx) =>
        tx.$queryRaw`
          SELECT
            public.sync_carrier_load(${job.id}::uuid,
              ${job.worker_id}::uuid,
              ${job.lease_version},
              ${operationToken}::uuid,
              ${snapshot.version}) AS result
          `,
    );
    return {
      loginIdentifier: value.loginIdentifier,
      password: value.password ?? undefined,
      token: value.token ?? undefined,
    };
  }
  async complete(
    userId: string,
    snapshot: LifecycleSnapshot,
    candidate: SealedCandidate,
    correlationId: string,
    eventType: CarrierAuditType = CarrierAuditType.RECONNECT,
  ): Promise<ConnectionMetadata> {
    if (eventType !== CarrierAuditType.RECOVERY)
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    const { job, operationToken } = this.scope(userId, snapshot.connection.id),
      p = candidate.password,
      t = candidate.token;
    const value = await this.result<StoredSnapshot["connection"]>((tx) =>
      tx.$queryRaw(
        buildCompleteWorkerRecoveryQuery({
          jobId: job.id,
          workerId: job.worker_id,
          leaseVersion: job.lease_version,
          operationToken: operationToken,
          version: snapshot.version,
          externalAccountId: candidate.externalAccountId,
          passwordCiphertext: p.ciphertext,
          passwordNonce: p.nonce,
          passwordAuthTag: p.authTag,
          passwordKeyVersion: p.keyVersion,
          tokenCiphertext: t.ciphertext,
          tokenNonce: t.nonce,
          tokenAuthTag: t.authTag,
          tokenKeyVersion: t.keyVersion,
          expiresAt: candidate.expiresAt,
          correlationId: correlationId,
        }),
      ),
    );
    return {
      ...value,
      createdAt: new Date(value.createdAt),
      lastVerifiedAt: value.lastVerifiedAt
        ? new Date(value.lastVerifiedAt)
        : null,
    };
  }
  async fail(
    userId: string,
    snapshot: LifecycleSnapshot,
    status: ConnectionStatus,
  ): Promise<void> {
    const { job, operationToken } = this.scope(userId, snapshot.connection.id);
    try {
      await this.result(
        (tx) =>
          tx.$queryRaw`
          SELECT
            public.sync_carrier_fail(${job.id}::uuid,
              ${job.worker_id}::uuid,
              ${job.lease_version},
              ${operationToken}::uuid,
              ${snapshot.version},
              ${status}::varchar)::text AS result
          `,
      );
    } catch (error) {
      if (
        error instanceof LifecycleFailure &&
        error.code === LifecycleCode.STALE
      )
        return;
      throw error;
    }
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
