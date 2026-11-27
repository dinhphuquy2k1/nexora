import {
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
  type BeforeApplicationShutdown,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { writeFile, rm } from "node:fs/promises";
import { SyncJobExecutor } from "../sync/application/sync-job-executor.service";
import { SyncRepository } from "../sync/infrastructure/sync-job.repository";
import { UnishipSyncRuntime } from "../sync/infrastructure/uniship-sync.runtime";
import { logWorkerFailure } from "../sync/infrastructure/worker-failure-log";
import {
  loadSyncConfig,
  SyncConfigurationError,
} from "../sync/domain/sync-policy";
class WorkerLoop
  implements
    OnApplicationBootstrap,
    BeforeApplicationShutdown,
    OnApplicationShutdown
{
  private readonly abort = new AbortController();
  private loop?: Promise<void>;
  constructor(private readonly queue: SyncRepository) {}
  onApplicationBootstrap() {
    this.loop = this.run();
  }
  private async run() {
    const workerId = randomUUID(),
      executor = new SyncJobExecutor(this.queue);
    while (!this.abort.signal.aborted) {
      try {
        await this.queue.schedule();
        const job = await this.queue.claim(workerId);
        if (job) await executor.execute(job, this.abort.signal);
        await this.queue.cleanup();
        await writeFile("/tmp/nexora-sync-heartbeat", String(Date.now()), {
          mode: 0o600,
        });
      } catch (error) {
        logWorkerFailure("sync_worker_cycle_failed", error);
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
  async beforeApplicationShutdown() {
    this.abort.abort();
    await this.loop;
  }
  async onApplicationShutdown() {
    await this.queue.close();
    await rm("/tmp/nexora-sync-heartbeat", { force: true });
  }
}
@Module({
  providers: [
    {
      provide: UnishipSyncRuntime,
      useFactory: () => {
        if (!process.env.DATABASE_URL)
          throw new SyncConfigurationError(
            "Missing worker database configuration",
          );
        return new UnishipSyncRuntime(
          process.env.DATABASE_URL,
          process.env,
          "worker",
        );
      },
    },
    {
      provide: SyncRepository,
      inject: [UnishipSyncRuntime],
      useFactory: (runtime: UnishipSyncRuntime) => {
        if (!process.env.DATABASE_URL)
          throw new SyncConfigurationError(
            "Missing worker database configuration",
          );
        return new SyncRepository(
          process.env.DATABASE_URL,
          loadSyncConfig(process.env),
          runtime.capabilities,
          "shared",
          runtime.eligibility,
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
