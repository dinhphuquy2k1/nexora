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
  async run<T>(operation: () => Promise<T>): Promise<T> {
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
    let succeeded = false;
    try {
      const result = await operation();
      succeeded = true;
      return result;
    } catch (error) {
      if (
        error instanceof LifecycleFailure &&
        (error.code === LifecycleCode.RATE_LIMITED ||
          error.code === LifecycleCode.SERVICE_UNAVAILABLE)
      ) {
        const delay = Math.max(
          Math.min(error.retryAfterMs, 300000),
          Math.min(60000, 1000 * 2 ** Math.min(slot.failures, 6)),
        );
        await this.db
          .$executeRaw`UPDATE sync_provider_budget SET blocked_until=greatest(coalesce(blocked_until,clock_timestamp()),clock_timestamp()+${delay}*interval '1 millisecond'),failures=failures+1 WHERE provider=${this.provider}`;
      }
      throw error;
    } finally {
      await this.db
        .$executeRaw`UPDATE sync_provider_budget SET lease_token=NULL,lease_expires_at=NULL WHERE id=${slot.id}::uuid AND lease_token=${token}::uuid`;
    }
  }
  async onApplicationShutdown() {
    await this.instance?.$disconnect();
  }
}
