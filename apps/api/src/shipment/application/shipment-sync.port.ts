import type { ShipmentProviderInput } from "../domain/shipment";
import type { LogisticsStageCode } from "@nexora/shared/shipment";
import type { SyncDomainSession } from "../../sync/application/sync.port";
export interface ShipmentSyncSession extends SyncDomainSession {
  readonly existingProviderStatus: string | null;
  readonly existingLogisticsStage: LogisticsStageCode | null;
  propose(
    input: ShipmentProviderInput,
    stage: LogisticsStageCode,
  ): Promise<void>;
}
