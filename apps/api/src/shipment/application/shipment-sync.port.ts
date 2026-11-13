import type { LogisticsStageCode } from "@nexora/shared/shipment";
import type { SyncDomainSession } from "../../sync/application/sync.port";
export interface ShipmentSyncSession extends SyncDomainSession {
  readonly existingProviderStatus: string | null;
  propose(input: unknown, stage: LogisticsStageCode): Promise<void>;
}
