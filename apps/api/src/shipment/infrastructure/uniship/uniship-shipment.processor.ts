import { parseUnsignedIntegerText } from "@nexora/shared/numeric";
import {
  LogisticsStage,
  type LogisticsStageCode,
} from "@nexora/shared/shipment";
import type {
  SyncDomainProcessor,
  SyncSource,
  SyncDecision,
} from "../../../sync/application/sync.port";
import {
  SyncType,
  SyncProcessingStatus,
  SyncErrorCode,
} from "../../../sync/domain/sync.constants";
import {
  ShipmentError,
  shipmentRecord,
  invalid,
  parseShipmentProviderInput,
} from "../../domain/shipment";
import type { ShipmentSyncSession } from "../../application/shipment-sync.port";
import { ShipmentSyncProcessor } from "../../application/shipment-sync.processor";
import { UnishipDiagnostic, type UnishipWarning } from "./uniship-normalizer";
const stages: Readonly<Record<string, LogisticsStageCode>> = Object.freeze({
  "1": LogisticsStage.TO_ORIGIN_WAREHOUSE,
  "2": LogisticsStage.AT_ORIGIN_WAREHOUSE,
  "3": LogisticsStage.TO_DEST_WAREHOUSE,
  "4": LogisticsStage.AT_DEST_WAREHOUSE,
  "5": LogisticsStage.DELIVERED,
});
/** Provider policy receives only validated status facts and the locked previous stage. */
function claimStage(
  oldStatus: string | null,
  previous: LogisticsStageCode | null,
): LogisticsStageCode {
  if (oldStatus !== null && Object.hasOwn(stages, oldStatus))
    return stages[oldStatus];
  return previous ?? LogisticsStage.UNKNOWN;
}
export class UnishipShipmentProcessor
  implements SyncDomainProcessor<ShipmentSyncSession>
{
  private readonly normal: ShipmentSyncProcessor;
  constructor(
    readonly version = 1,
    private readonly warn: UnishipWarning = (code) => console.warn(code),
  ) {
    this.normal = new ShipmentSyncProcessor(version, stages, () =>
      warn(UnishipDiagnostic.STATUS_UNKNOWN),
    );
  }
  supports(type: SyncType): boolean {
    return type === SyncType.SHIPMENT;
  }
  async apply(
    source: SyncSource,
    session: ShipmentSyncSession,
  ): Promise<SyncDecision> {
    try {
      const value = shipmentRecord(source.payload, [
        "shipment",
        "oldStatus",
        "invalid",
      ]);
      if (value.invalid === true) {
        if (Object.keys(value).length !== 1) invalid();
        return {
          outcome: SyncProcessingStatus.REJECTED_SOURCE,
          code: SyncErrorCode.SOURCE_INVALID,
        };
      }
      if (
        Object.hasOwn(value, "invalid") ||
        (value.oldStatus !== null &&
          parseUnsignedIntegerText(value.oldStatus) === null)
      )
        invalid();
      const shipment = parseShipmentProviderInput(value.shipment);
      if (
        typeof shipment.providerStatus !== "string" ||
        shipment.providerClaimStatus !==
          (shipment.providerStatus === "13" ? "13" : null)
      )
        invalid();
      const normalized = { ...source, payload: { ...shipment } };
      if (shipment.providerStatus !== "13")
        return this.normal.apply(normalized, session);
      const stage = claimStage(
        value.oldStatus as string | null,
        session.existingLogisticsStage,
      );
      return new ShipmentSyncProcessor(
        this.version,
        { ...stages, "13": stage },
        () => this.warn(UnishipDiagnostic.STATUS_UNKNOWN),
      ).apply(normalized, session);
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
