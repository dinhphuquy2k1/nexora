import { Prisma } from "@nexora/database";
import type { SyncJob } from "../../sync/application/sync.port";
import { SyncError } from "../../sync/domain/sync-policy";
import { SyncErrorCode as E } from "../../sync/domain/sync.constants";
import type { ProviderFields } from "../domain/shipment";
const columns: Record<keyof ProviderFields, string> = {
  trackingCode: "tracking_code",
  shipmentKind: "shipment_kind",
  originWarehouse: "origin_warehouse",
  serviceLevel: "service_level",
  weightKg: "weight_kg",
  packageCount: "package_count",
  itemCount: "item_count",
  declaredValue: "declared_value",
  declaredCurrency: "declared_currency",
  totalAmount: "total_amount",
  totalCurrency: "total_currency",
  exchangeRate: "exchange_rate",
  exchangeRateAt: "exchange_rate_at",
  providerStatus: "provider_status",
  logisticsStage: "logistics_stage",
  providerClaimStatus: "provider_claim_status",
  providerUpdatedAt: "provider_updated_at",
};
const decimalFields = new Set([
  "weightKg",
  "declaredValue",
  "totalAmount",
  "exchangeRate",
]);
const dateFields = new Set(["exchangeRateAt", "providerUpdatedAt"]);
/** Explicit provider-owned root operation. DB creates identity/code/created_at, not Prisma defaults. */
export async function persistShipmentProvider(
  tx: Prisma.TransactionClient,
  job: SyncJob,
  sourceId: string,
  existingId: string | null,
  fields: ProviderFields,
): Promise<{ id: string; providerStatus: string | null }> {
  const entries = Object.entries(fields) as [
    keyof ProviderFields,
    ProviderFields[keyof ProviderFields],
  ][];
  const values = entries.map(([key, value]) => {
    if (decimalFields.has(key)) return Prisma.sql`${value}::numeric`;
    if (dateFields.has(key)) return Prisma.sql`${value}::timestamptz`;
    return Prisma.sql`${value}`;
  });
  let rows: { id: string; providerStatus: string | null }[];
  if (existingId) {
    const assignments = entries.map(
      ([key], i) => Prisma.sql`${Prisma.raw(columns[key])}=${values[i]}`,
    );
    rows = await tx.$queryRaw(
      Prisma.sql`UPDATE shipments SET ${Prisma.join(assignments)},last_synced_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=${existingId}::uuid AND owner_user_id=${job.owner_user_id}::uuid AND source_identity_id=${sourceId}::uuid RETURNING id,provider_status AS "providerStatus"`,
    );
  } else {
    rows = await tx.$queryRaw(
      Prisma.sql`INSERT INTO shipments(owner_user_id,source_identity_id,carrier_connection_id,provider,${Prisma.join(entries.map(([key]) => Prisma.raw(columns[key])))},last_synced_at,updated_at) VALUES(${job.owner_user_id}::uuid,${sourceId}::uuid,${job.carrier_connection_id}::uuid,${job.provider},${Prisma.join(values)},clock_timestamp(),clock_timestamp()) RETURNING id,provider_status AS "providerStatus"`,
    );
  }
  if (rows.length !== 1) throw new SyncError(E.SOURCE_CONFLICT);
  return rows[0];
}
