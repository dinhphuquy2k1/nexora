import type { Prisma } from "@nexora/database";
import { ShipmentAggregate, type ShipmentState } from "../domain/shipment";
import type {
  LogisticsStageCode,
  ShipmentKindCode,
  ShipmentMilestoneCodeValue,
} from "@nexora/shared/shipment";
type StoredShipment = Prisma.ShipmentGetPayload<{
  include: { charges: true; milestones: true; items: true };
}>;
/** Hydration occurs only after source/root locks, with all current children. */
export function hydrateShipment(row: StoredShipment): ShipmentAggregate {
  const state: ShipmentState = {
    id: row.id,
    code: row.code,
    ownerUserId: row.ownerUserId,
    sourceIdentityId: row.sourceIdentityId,
    carrierConnectionId: row.carrierConnectionId,
    provider: row.provider,
    shipmentKind: row.shipmentKind as ShipmentKindCode,
    trackingCode: row.trackingCode,
    originWarehouse: row.originWarehouse,
    serviceLevel: row.serviceLevel,
    weightKg: row.weightKg?.toFixed(3) ?? null,
    packageCount: row.packageCount,
    itemCount: row.itemCount,
    declaredValue: row.declaredValue?.toFixed(2) ?? null,
    declaredCurrency: row.declaredCurrency,
    totalAmount: row.totalAmount?.toFixed(2) ?? null,
    totalCurrency: row.totalCurrency,
    exchangeRate: row.exchangeRate?.toFixed(6) ?? null,
    exchangeRateAt: row.exchangeRateAt?.toISOString() ?? null,
    providerStatus: row.providerStatus,
    logisticsStage: row.logisticsStage as LogisticsStageCode,
    providerClaimStatus: row.providerClaimStatus,
    providerUpdatedAt: row.providerUpdatedAt?.toISOString() ?? null,
    customerId: row.customerId,
    assigneeUserId: row.assigneeUserId,
    internalNote: row.internalNote,
    updatedByUserId: row.updatedByUserId,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    milestones: row.milestones.map((m) => ({
      id: m.id,
      milestoneCode: m.milestoneCode as ShipmentMilestoneCodeValue,
      occurredAt: m.occurredAt.toISOString(),
      locationName: m.locationName,
      providerLabel: m.providerLabel,
    })),
    items: row.items.map((i) => ({
      id: i.id,
      lineNo: i.lineNo,
      name: i.name,
      quantity: i.quantity,
      unitValue: i.unitValue?.toFixed(2) ?? null,
      currency: i.currency,
    })),
    charges: row.charges.map((c) => ({
      id: c.id,
      lineNo: c.lineNo,
      chargeCode:
        c.chargeCode as ShipmentState["charges"][number]["chargeCode"],
      amount: c.amount.toFixed(2),
      currency: c.currency,
      providerLabel: c.providerLabel,
    })),
  };
  return ShipmentAggregate.hydrate(state);
}
