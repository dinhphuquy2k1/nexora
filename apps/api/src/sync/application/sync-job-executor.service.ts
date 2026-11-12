import { SyncError, retryDelay } from "../domain/sync-policy";
import { SyncErrorCode, SyncProcessingPhase } from "../domain/sync.constants";
import type { SyncQueue, SyncJob } from "./sync.port";
export class SyncJobExecutor {
  constructor(
    private readonly queue: SyncQueue,
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
      const capability = this.queue.capabilities.resolve(
        job.provider,
        job.sync_type,
      );
      if (!this.queue.available(job.provider, job.sync_type) || !capability)
        throw new SyncError(SyncErrorCode.SYNC_UNAVAILABLE);
      if (job.processing_phase === SyncProcessingPhase.FETCHING) {
        if (job.fetch_strategy !== capability.strategy)
          throw new SyncError(SyncErrorCode.SYNC_UNAVAILABLE);
        const aborted = new Promise<never>((_resolve, reject) => {
          const handler = () => reject(execution.reason);
          execution.addEventListener("abort", handler, { once: true });
          removeAbort = () => execution.removeEventListener("abort", handler);
          if (execution.aborted) handler();
        });
        const page = await Promise.race([
          Promise.resolve().then(() =>
            capability.provider.fetch(job, execution),
          ),
          aborted,
        ]);
        execution.throwIfAborted();
        await this.queue.page(job, page, capability.processor.version);
      } else await this.queue.apply(job);
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
