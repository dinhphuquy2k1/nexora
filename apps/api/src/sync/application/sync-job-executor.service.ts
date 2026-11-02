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
    private readonly pageTimeoutMs = 20000,
  ) {}
  async execute(job: SyncJob, signal: AbortSignal) {
    const controller = new AbortController(),
      execution = AbortSignal.any([signal, controller.signal]);
    let renewal: Promise<void> | null = null;
    const heartbeat = setInterval(
      () => {
        if (!renewal)
          renewal = this.queue
            .heartbeat(job)
            .catch(() =>
              controller.abort(new SyncError(SyncErrorCode.SYNC_STALE)),
            )
            .finally(() => (renewal = null));
      },
      Math.max(100, (this.queue.config.leaseSeconds * 1000) / 3),
    );
    // Nexora's page resource bound, not a provider quota. Network never holds DB locks.
    const deadline =
      job.processing_phase === SyncProcessingPhase.FETCHING
        ? setTimeout(
            () => controller.abort(new SyncError(SyncErrorCode.PROVIDER_RETRY)),
            this.pageTimeoutMs,
          )
        : undefined;
    let removeAbort = () => {};
    try {
      execution.throwIfAborted();
      if (job.processing_phase === SyncProcessingPhase.FETCHING) {
        if (
          this.provider.strategy(job.provider, job.sync_type) !==
          job.fetch_strategy
        )
          throw new SyncError(SyncErrorCode.SYNC_UNAVAILABLE);
        const aborted = new Promise<never>((_resolve, reject) => {
          const handler = () => reject(execution.reason);
          execution.addEventListener("abort", handler, { once: true });
          removeAbort = () => execution.removeEventListener("abort", handler);
          if (execution.aborted) handler();
        });
        const page = await Promise.race([
          Promise.resolve().then(() => this.provider.fetch(job, execution)),
          aborted,
        ]);
        execution.throwIfAborted();
        await this.queue.page(job, page, this.processor.version);
      } else await this.queue.apply(job, this.processor);
    } catch (error) {
      let failure = error;
      if (execution.aborted)
        failure =
          execution.reason instanceof SyncError
            ? execution.reason
            : new SyncError(SyncErrorCode.PROVIDER_RETRY);
      if (
        failure instanceof SyncError &&
        failure.code === SyncErrorCode.SYNC_STALE
      )
        return;
      const code =
        failure instanceof SyncError
          ? failure.code
          : SyncErrorCode.INTERNAL_ERROR;
      await this.queue.wait(
        job,
        code,
        retryDelay(
          job.attempt_count,
          failure instanceof SyncError ? failure.retryAfterMs : 0,
        ),
      );
    } finally {
      removeAbort();
      clearInterval(heartbeat);
      if (deadline) clearTimeout(deadline);
      await renewal;
    }
  }
}
