import {
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile, rm } from "node:fs/promises";
import { SyncJobExecutor } from "../sync/application/sync-job-executor.service";
import { SyncRepository } from "../sync/infrastructure/sync-job.repository";
import {
  unavailableProvider,
  unavailableProcessor,
} from "../sync/infrastructure/provider-fetch.adapter";
import { loadSyncConfig } from "../sync/domain/sync-policy";
class WorkerLoop implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly abort = new AbortController();
  private loop?: Promise<void>;
  constructor(private readonly queue: SyncRepository) {}
  onApplicationBootstrap() {
    this.loop = this.run();
  }
  private async run() {
    const workerId = randomUUID(),
      executor = new SyncJobExecutor(
        this.queue,
        unavailableProvider,
        unavailableProcessor,
      );
    while (!this.abort.signal.aborted) {
      try {
        await this.queue.schedule();
        const job = await this.queue.claim(workerId);
        if (job) await executor.execute(job, this.abort.signal);
        await this.queue.cleanup();
        await writeFile("/tmp/nexora-sync-heartbeat", String(Date.now()), {
          mode: 0o600,
        });
      } catch {
        console.error(
          JSON.stringify({
            event: "sync_worker_cycle_failed",
            code: "INTERNAL_ERROR",
          }),
        );
      }
      try {
        await delay(this.queue.config.pollMs, undefined, {
          signal: this.abort.signal,
        });
      } catch {
        break;
      }
    }
  }
  async onApplicationShutdown() {
    this.abort.abort();
    await this.loop;
    await this.queue.close();
    await rm("/tmp/nexora-sync-heartbeat", { force: true });
  }
}
@Module({
  providers: [
    {
      provide: SyncRepository,
      useFactory: () => {
        if (!process.env.DATABASE_URL)
          throw new Error("Missing worker database configuration");
        return new SyncRepository(
          process.env.DATABASE_URL,
          loadSyncConfig(process.env),
          unavailableProvider,
          unavailableProcessor,
        );
      },
    },
    {
      provide: WorkerLoop,
      inject: [SyncRepository],
      useFactory: (queue: SyncRepository) => new WorkerLoop(queue),
    },
  ],
})
export class SyncWorkerModule {}
