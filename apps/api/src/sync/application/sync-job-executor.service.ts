import { SyncError, retryDelay } from "../domain/sync-policy";
import { SyncErrorCode, SyncProcessingPhase } from "../domain/sync.constants";
import type {
  SyncQueue,
  SyncProvider,
  SyncDomainProcessor,
  SyncJob,
} from "./sync.port";
export class SyncJobExecutor {
  constructor(
    private readonly queue: SyncQueue,
    private readonly provider: SyncProvider,
    private readonly processor: SyncDomainProcessor,
  ) {}
  async execute(job: SyncJob, signal: AbortSignal) {
    try {
      signal.throwIfAborted();
      if (job.processing_phase === SyncProcessingPhase.FETCHING) {
        const page = await this.provider.fetch(job, signal);
        signal.throwIfAborted();
        await this.queue.page(job, page, this.processor.version);
      } else await this.queue.apply(job, this.processor);
    } catch (error) {
      // A stale worker must never alter its successor's job, even to report failure.
      if (error instanceof SyncError && error.code === SyncErrorCode.SYNC_STALE)
        return;
      const code =
        error instanceof SyncError ? error.code : SyncErrorCode.INTERNAL_ERROR;
      await this.queue.wait(
        job,
        code,
        retryDelay(
          job.attempt_count,
          error instanceof SyncError ? error.retryAfterMs : 0,
        ),
      );
    }
  }
}
