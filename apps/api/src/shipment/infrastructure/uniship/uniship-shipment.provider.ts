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
import {
  parseUnishipWarehouses,
  parseUnishipPage,
  UnishipDiagnostic,
  type UnishipWarning,
} from "./uniship-normalizer";

/** Test-only composition until NEXORA-058; no production registration or live opt-in. */
export class UnishipShipmentProvider implements SyncProvider {
  constructor(
    private readonly client: UnishipHttpClient,
    private readonly lifecycle: Pick<
      CarrierConnectionLifecycleService,
      "withToken"
    >,
    private readonly store: Pick<CarrierLifecyclePort, "read">,
    private readonly warn: UnishipWarning = (code) => console.warn(code),
  ) {}
  strategy(provider: string, type: SyncType): "FULL" | null {
    return provider === CarrierProvider.UNISHIP && type === SyncType.SHIPMENT
      ? SyncStrategy.FULL
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
        async (token) => {
          signal.throwIfAborted();
          const warehouses = parseUnishipWarehouses(
            await this.client.getShipment(
              "/client/api/chinaStores/",
              token,
              signal,
            ),
            this.warn,
          );
          const query = new URLSearchParams({
            ecommerce: "true",
            filter: Buffer.from(
              JSON.stringify({
                filter: [
                  { column: "IsEcommerce", value: 1, condition: "equal" },
                ],
              }),
            ).toString("base64"),
            page: String(job.next_page),
            rowsPerPage: "100",
            q: "",
          });
          const text = await this.client.getShipment(
            "/client/api/transition/",
            token,
            signal,
            query,
          );
          signal.throwIfAborted();
          return parseUnishipPage(
            text,
            job.next_page,
            100,
            warehouses,
            this.warn,
          );
        },
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
