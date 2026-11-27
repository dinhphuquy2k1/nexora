import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { HttpException } from "@nestjs/common";
import { createDatabase, type PrismaClient } from "@nexora/database";
import { isUuid } from "../../../common/validation/uuid";
import { LifecycleCode, LifecycleFailure } from "../../domain/lifecycle";
import type { WorkerCarrierExecution } from "../worker-carrier-store";
export interface UnishipHttpContext {
  readonly ownerUserId: string;
  readonly connectionId: string | null;
  readonly execution?: WorkerCarrierExecution;
}
export interface UnishipHttpAdmission {
  run<T>(
    context: UnishipHttpContext,
    signal: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T>;
}
type Permit = { acquired: boolean; waitMs: number; cooldown: boolean };
/** Cross-process completion-based spacing; provider acquisition slots remain separate. */
export class PostgresHttpAdmission implements UnishipHttpAdmission {
  private instance?: PrismaClient;
  private readonly shutdown = new AbortController();
  private readonly pending = new Set<Promise<unknown>>();
  private closing?: Promise<void>;
  constructor(
    private readonly url: string,
    private readonly authority: "api" | "worker",
  ) {}
  private get db(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  private validate(context: UnishipHttpContext) {
    if (
      !context ||
      !isUuid(context.ownerUserId) ||
      (context.connectionId !== null && !isUuid(context.connectionId))
    )
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    if (this.authority === "worker") {
      const execution = context.execution;
      if (
        !execution ||
        execution.job.owner_user_id !== context.ownerUserId ||
        execution.job.carrier_connection_id !== context.connectionId ||
        !isUuid(execution.job.id) ||
        !isUuid(execution.job.worker_id) ||
        !isUuid(execution.operationToken) ||
        !Number.isSafeInteger(execution.job.lease_version) ||
        execution.job.lease_version < 1
      )
        throw new LifecycleFailure(LifecycleCode.STALE);
    }
  }
  private async query<T>(
    context: UnishipHttpContext,
    token: string,
    backoff?: number,
  ): Promise<T> {
    this.validate(context);
    try {
      return await this.db.$transaction(
        async (tx) => {
          // Bound even a database-lock wait; cancellation is rechecked after this short call.
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout='250ms'");
          await tx.$executeRawUnsafe("SET LOCAL statement_timeout='1000ms'");
          let rows: { result: T }[];
          if (this.authority === "worker") {
            const { job, operationToken } = context.execution!;
            rows =
              backoff === undefined
                ? await tx.$queryRaw`SELECT public.sync_carrier_http_reserve(${job.id}::uuid,${job.worker_id}::uuid,${job.lease_version},${operationToken}::uuid,${token}::uuid) AS result`
                : await tx.$queryRaw`SELECT public.sync_carrier_http_finish(${job.id}::uuid,${job.worker_id}::uuid,${job.lease_version},${operationToken}::uuid,${token}::uuid,${backoff}) AS result`;
          } else {
            rows =
              backoff === undefined
                ? await tx.$queryRaw`SELECT public.carrier_http_reserve(${context.ownerUserId}::uuid,${context.connectionId}::uuid,${token}::uuid) AS result`
                : await tx.$queryRaw`SELECT public.carrier_http_finish(${context.ownerUserId}::uuid,${context.connectionId}::uuid,${token}::uuid,${backoff}) AS result`;
          }
          if (rows.length !== 1)
            throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
          return rows[0].result;
        },
        { timeout: 2000 },
      );
    } catch (error) {
      if (error instanceof LifecycleFailure) throw error;
      throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
    }
  }
  private backoff(error: unknown): number {
    if (error instanceof LifecycleFailure) {
      if (error.code === LifecycleCode.RATE_LIMITED)
        return Math.max(1000, Math.min(error.retryAfterMs, 300000));
      if (error.code === LifecycleCode.SERVICE_UNAVAILABLE) return 1000;
    }
    if (error instanceof HttpException) {
      if (error.getStatus() >= 500) return 1000;
      if (error.getStatus() === 429) {
        const response = error.getResponse();
        const value =
          typeof response === "object" && "retryAfterMs" in response
            ? response.retryAfterMs
            : 1000;
        return typeof value === "number" && Number.isSafeInteger(value)
          ? Math.max(1000, Math.min(value, 300000))
          : 1000;
      }
    }
    return 0;
  }
  run<T>(
    context: UnishipHttpContext,
    cancellation: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (this.shutdown.signal.aborted)
      return Promise.reject(
        new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE),
      );
    const signal = AbortSignal.any([
      this.shutdown.signal,
      ...(cancellation ? [cancellation] : []),
    ]);
    const work = this.execute<T>(context, signal, operation);
    this.pending.add(work);
    void work.then(
      () => this.pending.delete(work),
      () => this.pending.delete(work),
    );
    return work;
  }
  private async execute<T>(
    context: UnishipHttpContext,
    cancellation: AbortSignal | undefined,
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    this.validate(context);
    const signal = AbortSignal.any([
        ...(cancellation ? [cancellation] : []),
        AbortSignal.timeout(15000),
      ]),
      token = randomUUID();
    let acquired = false;
    try {
      while (true) {
        signal.throwIfAborted();
        const permit = await this.query<Permit>(context, token);
        acquired = permit.acquired;
        signal.throwIfAborted();
        if (permit.acquired) {
          acquired = true;
          break;
        }
        if (permit.cooldown)
          throw new LifecycleFailure(
            LifecycleCode.RATE_LIMITED,
            Math.min(300000, Math.max(1000, permit.waitMs)),
          );
        await delay(Math.min(1000, Math.max(1, permit.waitMs)), undefined, {
          signal,
        });
      }
      // Revalidate owned lease/scope immediately before starting outbound dispatch.
      const owned = await this.query<Permit>(context, token);
      signal.throwIfAborted();
      if (!owned.acquired)
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      let backoff = 0,
        result: T | undefined,
        failure: unknown,
        failed = false;
      try {
        result = await operation(signal);
      } catch (error) {
        backoff = this.backoff(error);
        failure = error;
        failed = true;
      }
      const released = await this.query<boolean>(context, token, backoff);
      acquired = false;
      if (!released)
        throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
      if (failed) throw failure;
      return result as T;
    } finally {
      if (acquired) await this.query<boolean>(context, token, 0);
    }
  }
  async onApplicationShutdown() {
    return (this.closing ??= (async () => {
      this.shutdown.abort(
        new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE),
      );
      await Promise.allSettled([...this.pending]);
      await this.instance?.$disconnect();
    })());
  }
}
