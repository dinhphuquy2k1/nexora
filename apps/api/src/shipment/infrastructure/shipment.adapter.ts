import { createDatabase, Prisma, type PrismaClient } from "@nexora/database";
import {
  LogisticsStage,
  type LogisticsStageCode,
} from "@nexora/shared/shipment";
import { UserStatus } from "../../identity/domain/user-policy";
import { ShipmentError } from "../domain/shipment";
import {
  ShipmentReadPort,
  type ShipmentQuery,
  type ShipmentSummary,
  type ShipmentDetail,
  type ShipmentChargeView,
  type ShipmentHistoryView,
  type Pagination,
} from "../application/shipment-read.port";
const summary = Prisma.raw(
  's.id AS "id",s.code AS "code",s.tracking_code AS "trackingCode",s.shipment_kind AS "shipmentKind",s.provider AS "provider",s.logistics_stage AS "logisticsStage",s.provider_status AS "providerStatus",s.provider_claim_status AS "providerClaimStatus",s.customer_id AS "customerId",s.total_amount::text AS "totalAmount",s.total_currency AS "totalCurrency",s.created_at AS "createdAt",s.updated_at AS "updatedAt"',
);
const detail = Prisma.raw(
  's.id AS "id",s.code AS "code",s.tracking_code AS "trackingCode",s.shipment_kind AS "shipmentKind",s.provider AS "provider",s.logistics_stage AS "logisticsStage",s.provider_status AS "providerStatus",s.provider_claim_status AS "providerClaimStatus",s.customer_id AS "customerId",s.total_amount::text AS "totalAmount",s.total_currency AS "totalCurrency",s.created_at AS "createdAt",s.updated_at AS "updatedAt",s.origin_warehouse AS "originWarehouse",s.service_level AS "serviceLevel",s.weight_kg::text AS "weightKg",s.package_count AS "packageCount",s.item_count AS "itemCount",s.declared_value::text AS "declaredValue",s.declared_currency AS "declaredCurrency",s.exchange_rate::text AS "exchangeRate",s.exchange_rate_at AS "exchangeRateAt",s.provider_updated_at AS "providerUpdatedAt",s.last_synced_at AS "lastSyncedAt",s.assignee_user_id AS "assigneeUserId",s.internal_note AS "internalNote"',
);
function pagination(q: ShipmentQuery, total: number): Pagination {
  return {
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.ceil(total / q.pageSize),
  };
}
export class ShipmentAdapter extends ShipmentReadPort {
  private instance?: PrismaClient;
  constructor(private readonly url: string) {
    super();
  }
  get client(): PrismaClient {
    return (this.instance ??= createDatabase(this.url));
  }
  async close() {
    await this.instance?.$disconnect();
  }
  async onApplicationShutdown() {
    await this.close();
  }
  private transaction<T>(
    owner: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(async (tx) => {
      // Same exclusive actor-read lock as Customer; serializes page/counts with worker actor locks.
      const actor = await tx.$queryRaw<
        { status: string }[]
      >`SELECT status FROM users WHERE id=${owner}::uuid FOR UPDATE`;
      if (actor[0]?.status !== UserStatus.ACTIVE)
        throw new ShipmentError("UNAUTHORIZED");
      return fn(tx);
    });
  }
  async list(owner: string, q: ShipmentQuery) {
    return this.transaction(owner, async (tx) => {
      const pattern = "%" + (q.q ?? "").replace(/[\\%_]/g, "\\$&") + "%";
      const base = Prisma.sql`s.owner_user_id=${owner}::uuid AND s.tracking_code ILIKE ${pattern}`;
      const where = q.stage
        ? Prisma.sql`${base} AND s.logistics_stage=${q.stage}`
        : base;
      const shipments = await tx.$queryRaw<ShipmentSummary[]>(
        Prisma.sql`SELECT ${summary} FROM shipments s WHERE ${where} ORDER BY s.created_at DESC,s.id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      );
      const counts = await tx.$queryRaw<
        { stage: LogisticsStageCode; count: number }[]
      >(
        Prisma.sql`SELECT s.logistics_stage AS stage,count(*)::int AS count FROM shipments s WHERE ${base} GROUP BY s.logistics_stage`,
      );
      const byStage = Object.fromEntries(
        Object.values(LogisticsStage).map((s) => [s, 0]),
      ) as Record<LogisticsStageCode, number>;
      let total = 0;
      for (const row of counts) {
        byStage[row.stage] = row.count;
        total += row.count;
      }
      return {
        shipments,
        pagination: pagination(q, q.stage ? byStage[q.stage] : total),
        stats: { total, byStage, claims: null },
        claimFilterAvailable: false as const,
      };
    });
  }
  async get(owner: string, id: string) {
    return this.transaction(owner, async (tx) => {
      const rows = await tx.$queryRaw<Omit<ShipmentDetail, "charges">[]>(
        Prisma.sql`SELECT ${detail} FROM shipments s WHERE s.id=${id}::uuid AND s.owner_user_id=${owner}::uuid`,
      );
      if (!rows.length) throw new ShipmentError("NOT_FOUND");
      const charges = await tx.$queryRaw<
        ShipmentChargeView[]
      >`SELECT id,line_no AS "lineNo",charge_code AS "chargeCode",amount::text,currency,provider_label AS "providerLabel" FROM shipment_charges WHERE shipment_id=${id}::uuid ORDER BY line_no`;
      return { ...rows[0], charges };
    });
  }
  async history(owner: string, id: string, q: ShipmentQuery) {
    return this.transaction(owner, async (tx) => {
      const root = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM shipments WHERE id=${id}::uuid AND owner_user_id=${owner}::uuid`;
      if (!root.length) throw new ShipmentError("NOT_FOUND");
      const history = await tx.$queryRaw<
        ShipmentHistoryView[]
      >`SELECT id,source_version AS "sourceVersion",processor_version AS "processorVersion",from_stage AS "fromStage",to_stage AS "toStage",provider_status AS "providerStatus",provider_changed_at AS "providerChangedAt",observed_at AS "observedAt" FROM shipment_stage_history WHERE shipment_id=${id}::uuid ORDER BY observed_at DESC,id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`;
      const count = await tx.$queryRaw<
        { total: number }[]
      >`SELECT count(*)::int AS total FROM shipment_stage_history WHERE shipment_id=${id}::uuid`;
      return { history, pagination: pagination(q, count[0].total) };
    });
  }
}
