import { createDatabase, Prisma, type PrismaClient } from "@nexora/database";
import {
  LogisticsStage,
  ShipmentChargeCode as C,
  ShipmentMilestoneCode as M,
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
  type ShipmentMilestoneView,
  type ShipmentItemView,
  type ShipmentChargeSummary,
  type ShipmentMilestoneSummary,
  type Pagination,
} from "../application/shipment-read.port";
type RootSummary = Omit<
  ShipmentSummary,
  "chargeSummary" | "milestoneSummary" | "itemSummary"
>;
type ChargeGroup = {
  shipmentId: string;
  chargeCode: string;
  count: number;
  amount: string | null;
  currency: string | null;
};
type MilestoneGroup = Pick<
  ShipmentMilestoneView,
  "milestoneCode" | "occurredAt" | "locationName"
> & { shipmentId: string };
const summary = Prisma.raw(
  's.id AS "id",s.code AS "code",s.tracking_code AS "trackingCode",s.shipment_kind AS "shipmentKind",s.provider AS "provider",s.logistics_stage AS "logisticsStage",s.provider_status AS "providerStatus",s.provider_claim_status AS "providerClaimStatus",s.customer_id AS "customerId",s.total_amount::text AS "totalAmount",s.total_currency AS "totalCurrency",s.created_at AS "createdAt",s.updated_at AS "updatedAt",s.origin_warehouse AS "originWarehouse",s.weight_kg::text AS "weightKg",s.package_count AS "packageCount",s.item_count AS "itemCount",s.declared_value::text AS "declaredValue",s.declared_currency AS "declaredCurrency"',
);
const detail = Prisma.sql`${summary},${Prisma.raw('s.service_level AS "serviceLevel",s.exchange_rate::text AS "exchangeRate",s.exchange_rate_at AS "exchangeRateAt",s.provider_updated_at AS "providerUpdatedAt",s.last_synced_at AS "lastSyncedAt",s.assignee_user_id AS "assigneeUserId",s.internal_note AS "internalNote"')}`;
function chargeSummary(
  rows: Pick<ChargeGroup, "chargeCode" | "count" | "amount" | "currency">[],
): ShipmentChargeSummary {
  const amount = (code: string) => {
    const row = rows.find((r) => r.chargeCode === code);
    if (!row) return { state: "NONE" as const, amount: null, currency: null };
    if (row.count !== 1)
      return { state: "MULTIPLE" as const, amount: null, currency: null };
    return {
      state: "SINGLE" as const,
      amount: row.amount,
      currency: row.currency,
    };
  };
  const has = (code: string) => rows.some((r) => r.chargeCode === code);
  return {
    unitPrice: amount(C.UNIT_PRICE),
    domesticShipping: amount(C.DOMESTIC_SHIPPING),
    hasInsurance: has(C.INSURANCE),
    hasCounting: has(C.COUNTING),
    hasWoodPacking: has(C.WOOD_PACKING),
    hasBubbleWrap: has(C.BUBBLE_WRAP),
  };
}
function milestoneSummary(
  rows: Pick<MilestoneGroup, "milestoneCode" | "occurredAt" | "locationName">[],
): ShipmentMilestoneSummary {
  const entry = (code: string) => rows.find((r) => r.milestoneCode === code);
  return {
    originReceivedAt: entry(M.ORIGIN_RECEIVED)?.occurredAt ?? null,
    originDispatchedAt: entry(M.ORIGIN_DISPATCHED)?.occurredAt ?? null,
    destReceivedAt: entry(M.DEST_RECEIVED)?.occurredAt ?? null,
    destDispatchedAt: entry(M.DEST_DISPATCHED)?.occurredAt ?? null,
    destWarehouse: entry(M.DEST_RECEIVED)?.locationName ?? null,
  };
}
function groupByShipment<T extends { shipmentId: string }>(
  rows: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.shipmentId) ?? [];
    group.push(row);
    groups.set(row.shipmentId, group);
  }
  return groups;
}
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
      const shipments = await tx.$queryRaw<RootSummary[]>(
        Prisma.sql`SELECT ${summary} FROM shipments s WHERE ${where} ORDER BY s.created_at DESC,s.id DESC LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`,
      );
      const counts = await tx.$queryRaw<
        { stage: LogisticsStageCode; count: number }[]
      >(
        Prisma.sql`SELECT s.logistics_stage AS stage,count(*)::int AS count FROM shipments s WHERE ${base} GROUP BY s.logistics_stage`,
      );
      let chargeRows: ChargeGroup[] = [],
        milestoneRows: MilestoneGroup[] = [];
      let itemRows: {
        shipmentId: string;
        firstName: string;
        lineCount: number;
      }[] = [];
      if (shipments.length) {
        const ids = shipments.map((row) => row.id);
        chargeRows = await tx.$queryRaw<
          ChargeGroup[]
        >`SELECT shipment_id AS "shipmentId",charge_code AS "chargeCode",count(*)::int AS count,CASE WHEN count(*)=1 THEN max(amount)::text ELSE NULL END AS amount,CASE WHEN count(*)=1 THEN min(currency::text) ELSE NULL END AS currency FROM shipment_charges WHERE shipment_id=ANY(${ids}::uuid[]) GROUP BY shipment_id,charge_code`;
        milestoneRows = await tx.$queryRaw<
          MilestoneGroup[]
        >`SELECT shipment_id AS "shipmentId",milestone_code AS "milestoneCode",occurred_at AS "occurredAt",location_name AS "locationName" FROM shipment_milestones WHERE shipment_id=ANY(${ids}::uuid[])`;
        itemRows = await tx.$queryRaw<
          typeof itemRows
        >`WITH grouped AS (SELECT shipment_id,min(line_no) AS first_line,count(*)::int AS "lineCount" FROM shipment_items WHERE shipment_id=ANY(${ids}::uuid[]) GROUP BY shipment_id) SELECT g.shipment_id AS "shipmentId",i.name AS "firstName",g."lineCount" FROM grouped g JOIN shipment_items i ON i.shipment_id=g.shipment_id AND i.line_no=g.first_line`;
      }
      const chargesById = groupByShipment(chargeRows),
        milestonesById = groupByShipment(milestoneRows);
      const itemsById = new Map(
        itemRows.map((row) => [
          row.shipmentId,
          { firstName: row.firstName, lineCount: row.lineCount },
        ]),
      );
      const projected = shipments.map((row) => ({
        ...row,
        chargeSummary: chargeSummary(chargesById.get(row.id) ?? []),
        milestoneSummary: milestoneSummary(milestonesById.get(row.id) ?? []),
        itemSummary: itemsById.get(row.id) ?? { firstName: null, lineCount: 0 },
      }));
      const byStage = Object.fromEntries(
        Object.values(LogisticsStage).map((s) => [s, 0]),
      ) as Record<LogisticsStageCode, number>;
      let total = 0;
      for (const row of counts) {
        byStage[row.stage] = row.count;
        total += row.count;
      }
      return {
        shipments: projected,
        pagination: pagination(q, q.stage ? byStage[q.stage] : total),
        stats: { total, byStage, claims: null },
        claimFilterAvailable: false as const,
      };
    });
  }
  async get(owner: string, id: string) {
    return this.transaction(owner, async (tx) => {
      const rows = await tx.$queryRaw<
        Omit<
          ShipmentDetail,
          | "charges"
          | "milestones"
          | "items"
          | "chargeSummary"
          | "milestoneSummary"
          | "itemSummary"
        >[]
      >(
        Prisma.sql`SELECT ${detail} FROM shipments s WHERE s.id=${id}::uuid AND s.owner_user_id=${owner}::uuid`,
      );
      if (!rows.length) throw new ShipmentError("NOT_FOUND");
      const charges = await tx.$queryRaw<
        (ShipmentChargeView & { count: number })[]
      >`SELECT id,line_no AS "lineNo",charge_code AS "chargeCode",amount::text,currency,provider_label AS "providerLabel",count(*) OVER(PARTITION BY charge_code)::int AS count FROM shipment_charges WHERE shipment_id=${id}::uuid ORDER BY line_no`;
      const milestones = await tx.$queryRaw<
        ShipmentMilestoneView[]
      >`SELECT id,milestone_code AS "milestoneCode",occurred_at AS "occurredAt",location_name AS "locationName",provider_label AS "providerLabel" FROM shipment_milestones WHERE shipment_id=${id}::uuid`;
      const order = Object.values(M);
      milestones.sort(
        (a, b) =>
          order.indexOf(a.milestoneCode) - order.indexOf(b.milestoneCode),
      );
      const items = await tx.$queryRaw<
        ShipmentItemView[]
      >`SELECT id,line_no AS "lineNo",name,quantity,unit_value::text AS "unitValue",currency FROM shipment_items WHERE shipment_id=${id}::uuid ORDER BY line_no`;
      return {
        ...rows[0],
        charges: charges.map(
          ({ id, lineNo, chargeCode, amount, currency, providerLabel }) => ({
            id,
            lineNo,
            chargeCode,
            amount,
            currency,
            providerLabel,
          }),
        ),
        milestones,
        items,
        chargeSummary: chargeSummary(charges),
        milestoneSummary: milestoneSummary(milestones),
        itemSummary: {
          firstName: items[0]?.name ?? null,
          lineCount: items.length,
        },
      };
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
