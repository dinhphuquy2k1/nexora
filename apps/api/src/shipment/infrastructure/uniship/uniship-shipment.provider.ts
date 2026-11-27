import type { LifecycleSnapshot } from "../../../carrier/application/carrier-lifecycle.port";
import type { UnishipHttpContext } from "../../../carrier/infrastructure/uniship/postgres-http-admission";
import { UNISHIP_FULL_SCAN, UNISHIP_SCAN } from "./uniship-full-scan";
import type {
  SyncProvider,
  SyncJob,
  SyncPage,
} from "../../../sync/application/sync.port";
import {
  SyncType,
  SyncStrategy,
  SyncErrorCode,
} from "../../../sync/domain/sync.constants";
import { SyncError } from "../../../sync/domain/sync-policy";
import { CarrierProvider } from "../../../carrier/domain/carrier";
import {
  LifecycleFailure,
  LifecycleCode,
} from "../../../carrier/domain/lifecycle";
import type { CarrierConnectionLifecycleService } from "../../../carrier/application/carrier-connection-lifecycle.service";
import type { CarrierLifecyclePort } from "../../../carrier/application/carrier-lifecycle.port";
import {
  UnishipHttpClient,
  UnishipResponseError,
} from "../../../carrier/infrastructure/uniship/uniship-http.client";
import { UNISHIP_ROUTES } from "../../../carrier/infrastructure/uniship/uniship-routes";
import {
  parseUnishipWarehouses,
  parseUnishipPage,
  UnishipDiagnostic,
  type UnishipWarning,
} from "./uniship-normalizer";

/** Shared adapter; runtime registration remains subject to controlled activation and the live gate. */
export class UnishipShipmentProvider implements SyncProvider {
  readonly fullScan = UNISHIP_FULL_SCAN;
  constructor(
    private readonly client: UnishipHttpClient,
    private readonly lifecycle: Pick<
      CarrierConnectionLifecycleService,
      "withToken"
    >,
    private readonly store: Pick<CarrierLifecyclePort, "read">,
    private readonly warn: UnishipWarning = (code) => console.warn(code),
    private readonly context?: (
      job: SyncJob,
      snapshot: LifecycleSnapshot,
    ) => UnishipHttpContext,
  ) {}
  strategy(provider: string, type: SyncType): "FULL" | "INCREMENTAL" | null {
    return provider === CarrierProvider.UNISHIP && type === SyncType.SHIPMENT
      ? UNISHIP_SCAN.definition.strategy
      : null;
  }
  async fetch(job: SyncJob, signal: AbortSignal): Promise<SyncPage> {
    signal.throwIfAborted();
    if (
      !this.strategy(job.provider, job.sync_type) ||
      job.fetch_strategy !== SyncStrategy.FULL ||
      !job.carrier_connection_id
    )
      throw new SyncError(SyncErrorCode.SYNC_UNAVAILABLE);
    if (
      !Number.isSafeInteger(job.next_page) ||
      job.next_page < 1 ||
      job.next_cursor !== null ||
      job.target_watermark !== null
    )
      throw new SyncError(SyncErrorCode.SOURCE_INVALID);
    try {
      const snapshot = await this.store.read(
        job.owner_user_id,
        job.carrier_connection_id,
      );
      if (
        snapshot.connection.id !== job.carrier_connection_id ||
        snapshot.connection.provider !== job.provider ||
        snapshot.connection.externalAccountId !== job.external_account_id ||
        snapshot.generation !== job.generation ||
        snapshot.version !== job.lifecycle_version
      )
        throw new SyncError(SyncErrorCode.SYNC_STALE);
      return await this.lifecycle.withToken(
        job.owner_user_id,
        job.carrier_connection_id,
        async (token, tokenSignal) => {
          const cancellation = tokenSignal
            ? AbortSignal.any([signal, tokenSignal])
            : signal;
          cancellation.throwIfAborted();
          const context = this.context?.(job, snapshot);
          const warehouses = parseUnishipWarehouses(
            await this.client.getShipment(
              UNISHIP_ROUTES.WAREHOUSES,
              token,
              cancellation,
              new URLSearchParams(),
              context,
            ),
            this.warn,
          );
          const { endpoint, query } = UNISHIP_SCAN.request(job.next_page);
          const text = await this.client.getShipment(
            endpoint,
            token,
            cancellation,
            query,
            context,
          );
          signal.throwIfAborted();
          return parseUnishipPage(
            text,
            job.next_page,
            this.fullScan.pageSize,
            warehouses,
            this.warn,
          );
        },
        undefined,
        signal,
      );
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      if (error instanceof UnishipResponseError) {
        this.warn(UnishipDiagnostic.ENVELOPE_INVALID);
        throw new SyncError(SyncErrorCode.SOURCE_INVALID);
      }
      if (error instanceof LifecycleFailure) {
        if (error.code === LifecycleCode.STALE)
          throw new SyncError(SyncErrorCode.SYNC_STALE);
        if (
          error.code === LifecycleCode.RATE_LIMITED ||
          error.code === LifecycleCode.SERVICE_UNAVAILABLE
        )
          throw new SyncError(SyncErrorCode.PROVIDER_RETRY, error.retryAfterMs);
        throw new SyncError(SyncErrorCode.SYNC_UNAVAILABLE);
      }
      throw error;
    }
  }
}
