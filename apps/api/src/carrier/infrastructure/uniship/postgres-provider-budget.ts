import { randomUUID } from "node:crypto";
import { createDatabase, type PrismaClient } from "@nexora/database";
import { LifecycleFailure, LifecycleCode } from "../../domain/lifecycle";
import { CarrierProvider } from "../../domain/carrier";
/** Shared acquisition safeguards, not a statement of official provider quota. */
export class PostgresProviderBudget {
  private instance?: PrismaClient;
  constructor(
    private readonly url: string,
    private readonly provider = CarrierProvider.UNISHIP,
  ) {}
  private get db(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  async run<T>(operation: (signal?: AbortSignal) => Promise<T>): Promise<T> {
    const token = randomUUID();
    const slot = await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO sync_provider_budget(provider,slot) VALUES(${this.provider},0),(${this.provider},1) ON CONFLICT DO NOTHING`;
      // All acquisitions serialize just this tiny reservation transaction; HTTP stays outside it.
      const slots = await tx.$queryRaw<
        { id: string; available: boolean; blocked: boolean; failures: number }[]
      >`SELECT id,(lease_token IS NULL OR lease_expires_at<=clock_timestamp()) AS available,(blocked_until>clock_timestamp()) AS blocked,failures FROM sync_provider_budget WHERE provider=${this.provider} ORDER BY slot FOR UPDATE`;
      const free = slots.find((s) => s.available);
      if (slots.some((s) => s.blocked) || !free)
        throw new LifecycleFailure(LifecycleCode.RATE_LIMITED, 1000);
      await tx.$executeRaw`UPDATE sync_provider_budget SET lease_token=${token}::uuid,lease_expires_at=clock_timestamp()+interval '30 seconds' WHERE id=${free.id}::uuid`;
      return free;
    });
    const controller = new AbortController();
    let renewal: Promise<void> | null = null;
    const lost = () => {
      controller.abort(new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE));
      clearInterval(timer);
    };
    const timer = setInterval(() => {
      if (renewal || controller.signal.aborted) return;
      renewal = this.db.$queryRaw<
        { id: string }[]
      >`UPDATE sync_provider_budget SET lease_expires_at=clock_timestamp()+interval '30 seconds' WHERE id=${slot.id}::uuid AND lease_token=${token}::uuid AND lease_expires_at>clock_timestamp() RETURNING id`
        .then((rows) => {
          if (rows.length !== 1) lost();
        })
        .catch(lost)
        .finally(() => {
          renewal = null;
        });
    }, 10000);
    try {
      let value: T | undefined,
        failure: unknown,
        failed = false;
      try {
        value = await operation(controller.signal);
      } catch (error) {
        failed = true;
        failure = error;
      }
      clearInterval(timer);
      await renewal;
      controller.signal.throwIfAborted();
      // Serialize terminal bookkeeping in acquisition order. Lost owners cannot
      // return success, reset failures, impose cooldown, or affect a successor.
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM sync_provider_budget WHERE provider=${this.provider} ORDER BY slot FOR UPDATE`;
        const owned = await tx.$queryRaw<
          { id: string }[]
        >`UPDATE sync_provider_budget SET lease_expires_at=clock_timestamp()+interval '30 seconds' WHERE id=${slot.id}::uuid AND lease_token=${token}::uuid AND lease_expires_at>clock_timestamp() RETURNING id`;
        if (owned.length !== 1)
          throw new LifecycleFailure(LifecycleCode.SERVICE_UNAVAILABLE);
        if (!failed)
          await tx.$executeRaw`UPDATE sync_provider_budget SET failures=0 WHERE provider=${this.provider}`;
        else if (
          failure instanceof LifecycleFailure &&
          (failure.code === LifecycleCode.RATE_LIMITED ||
            failure.code === LifecycleCode.SERVICE_UNAVAILABLE)
        ) {
          const delay = Math.max(
            Math.min(failure.retryAfterMs, 300000),
            Math.min(60000, 1000 * 2 ** Math.min(slot.failures, 6)),
          );
          await tx.$executeRaw`UPDATE sync_provider_budget SET blocked_until=greatest(coalesce(blocked_until,clock_timestamp()),clock_timestamp()+${delay}*interval '1 millisecond'),failures=failures+1 WHERE provider=${this.provider}`;
        }
      });
      if (failed) throw failure;
      return value as T;
    } finally {
      clearInterval(timer);
      await renewal;
      await this.db
        .$executeRaw`UPDATE sync_provider_budget SET lease_token=NULL,lease_expires_at=NULL WHERE id=${slot.id}::uuid AND lease_token=${token}::uuid`;
    }
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
