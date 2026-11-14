import {
  LogisticsStage,
  type LogisticsStageCode,
} from "@nexora/shared/shipment";
import type {
  SyncDomainProcessor,
  SyncSource,
  SyncDecision,
} from "../../sync/application/sync.port";
import {
  SyncType,
  SyncErrorCode,
  SyncProcessingStatus,
} from "../../sync/domain/sync.constants";
import { ShipmentError, parseShipmentProviderInput } from "../domain/shipment";
import type { ShipmentSyncSession } from "./shipment-sync.port";
/** No provider mapping is bundled. Each future verified mapper needs its own version. */
export class ShipmentSyncProcessor
  implements SyncDomainProcessor<ShipmentSyncSession>
{
  private readonly mappings: Readonly<Record<string, LogisticsStageCode>>;
  constructor(
    readonly version: number,
    mappings: Readonly<Record<string, LogisticsStageCode>>,
    private readonly warn: (code: string) => void = (code) =>
      console.warn(code),
  ) {
    if (
      !Number.isSafeInteger(version) ||
      version < 1 ||
      Object.values(mappings).some(
        (v) => !Object.values(LogisticsStage).includes(v),
      )
    )
      throw new Error("Invalid Shipment processor configuration");
    this.mappings = Object.freeze({ ...mappings });
  }
  supports(type: SyncType): boolean {
    return type === SyncType.SHIPMENT;
  }
  async apply(
    source: SyncSource,
    session: ShipmentSyncSession,
  ): Promise<SyncDecision> {
    try {
      const input = parseShipmentProviderInput(source.payload);
      const status = Object.hasOwn(input, "providerStatus")
        ? input.providerStatus
        : session.existingProviderStatus;
      let stage = LogisticsStage.UNKNOWN as LogisticsStageCode;
      if (typeof status === "string" && Object.hasOwn(this.mappings, status))
        stage = this.mappings[status];
      else if (status !== null && status !== undefined)
        this.warn("SHIPMENT_STATUS_UNMAPPED");
      await session.propose(input, stage);
      return { outcome: SyncProcessingStatus.APPLIED };
    } catch (error) {
      if (error instanceof ShipmentError && error.code === "VALIDATION_ERROR")
        return {
          outcome: SyncProcessingStatus.REJECTED_SOURCE,
          code: SyncErrorCode.SOURCE_INVALID,
        };
      throw error;
    }
  }
}
