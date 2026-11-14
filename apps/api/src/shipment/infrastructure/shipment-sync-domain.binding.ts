import { persistShipmentProvider } from "./shipment-provider.persistence";
import { hydrateShipment } from "./shipment.mapper";
import type { SyncDomainProcessor } from "../../sync/application/sync.port";
import type { SyncDomainBinding } from "../../sync/infrastructure/sync-domain.binding";
import { SyncError } from "../../sync/domain/sync-policy";
import { SyncErrorCode as E, SyncType } from "../../sync/domain/sync.constants";
import { ShipmentAggregate, type ProviderOperation } from "../domain/shipment";
import type { ShipmentSyncSession } from "../application/shipment-sync.port";
/** Transaction and source lock are owned by Sync; never create another client here. */
export function createShipmentSyncBinding(
  processor: SyncDomainProcessor<ShipmentSyncSession>,
): SyncDomainBinding {
  const version = processor.version;
  return Object.freeze<SyncDomainBinding>({
    version,
    supports: (type) =>
      type === SyncType.SHIPMENT &&
      processor.version === version &&
      processor.supports(type),
    async begin(tx, job, source) {
      const assertVersion = () => {
        if (
          processor.version !== version ||
          !processor.supports(job.sync_type) ||
          job.sync_type !== SyncType.SHIPMENT ||
          source.processorVersion !== version
        )
          throw new SyncError(E.PROCESSOR_UNAVAILABLE);
      };
      assertVersion();
      if (!job.carrier_connection_id) throw new SyncError(E.SYNC_STALE);
      const scoped = await tx.$queryRaw<
        { id: string }[]
      >`SELECT s.id FROM sync_source_identities s JOIN provider_source_records p ON p.source_identity_id=s.id WHERE s.id=${source.id}::uuid AND s.owner_user_id=${job.owner_user_id}::uuid AND s.provider=${job.provider} AND s.external_account_id=${job.external_account_id} AND s.sync_type=${SyncType.SHIPMENT} AND p.source_version=${source.sourceVersion} AND p.processor_version=${version} FOR UPDATE OF s,p`;
      if (scoped.length !== 1) throw new SyncError(E.SOURCE_CONFLICT);
      const locked = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM shipments WHERE source_identity_id=${source.id}::uuid AND owner_user_id=${job.owner_user_id}::uuid FOR UPDATE`;
      const existing = locked.length
        ? await tx.shipment.findUniqueOrThrow({
            where: { id: locked[0].id },
            include: {
              charges: { orderBy: { lineNo: "asc" } },
              milestones: true,
              items: { orderBy: { lineNo: "asc" } },
            },
          })
        : null;
      if (existing && existing.provider !== job.provider)
        throw new SyncError(E.SOURCE_CONFLICT);
      const aggregate = existing ? hydrateShipment(existing) : null;
      let active = true,
        proposed: ProviderOperation | undefined;
      const assertActive = () => {
        if (!active) throw new SyncError(E.SYNC_STALE);
        assertVersion();
      };
      const session: ShipmentSyncSession = Object.freeze({
        scope: Object.freeze({
          ownerId: job.owner_user_id,
          connectionId: job.carrier_connection_id,
          sourceId: source.id,
          provider: job.provider,
          externalAccountId: job.external_account_id,
          syncType: job.sync_type,
        }),
        existingProviderStatus: existing?.providerStatus ?? null,
        async propose(
          input: unknown,
          stage: Parameters<ShipmentSyncSession["propose"]>[1],
        ) {
          assertActive();
          if (proposed) throw new SyncError(E.SOURCE_CONFLICT);
          if (aggregate) {
            aggregate.applyProvider(input, stage);
            proposed = aggregate.operation();
          } else
            proposed = ShipmentAggregate.create(
              {
                ownerUserId: job.owner_user_id,
                sourceIdentityId: source.id,
                carrierConnectionId: job.carrier_connection_id,
                provider: job.provider,
              },
              input,
              stage,
            ).operation();
        },
      });
      return {
        async decide() {
          assertActive();
          const decision = await processor.apply(source, session);
          assertActive();
          return decision;
        },
        async commit() {
          assertActive();
          if (!proposed) throw new SyncError(E.PROCESSOR_UNAVAILABLE);
          active = false;
          const {
            fields,
            charges,
            milestones,
            items,
            stageChanged,
            fromStage,
            providerChangedAt,
          } = proposed;
          const root = await persistShipmentProvider(
            tx,
            job,
            source.id,
            existing?.id ?? null,
            fields,
          );
          if (charges !== undefined) {
            // Position is the stable current-snapshot key. Never bulk-reinsert children.
            for (const line of charges)
              await tx.$executeRaw`INSERT INTO shipment_charges(shipment_id,line_no,charge_code,amount,currency,provider_label) VALUES(${root.id}::uuid,${line.lineNo},${line.chargeCode},${line.amount}::numeric,${line.currency},${line.providerLabel}) ON CONFLICT(shipment_id,line_no) DO UPDATE SET charge_code=EXCLUDED.charge_code,amount=EXCLUDED.amount,currency=EXCLUDED.currency,provider_label=EXCLUDED.provider_label WHERE (shipment_charges.charge_code,shipment_charges.amount,shipment_charges.currency,shipment_charges.provider_label) IS DISTINCT FROM (EXCLUDED.charge_code,EXCLUDED.amount,EXCLUDED.currency,EXCLUDED.provider_label)`;
            await tx.shipmentCharge.deleteMany({
              where: { shipmentId: root.id, lineNo: { gt: charges.length } },
            });
          }
          if (milestones !== undefined) {
            for (const entry of milestones)
              await tx.$executeRaw`INSERT INTO shipment_milestones(shipment_id,milestone_code,occurred_at,location_name,provider_label) VALUES(${root.id}::uuid,${entry.milestoneCode},${entry.occurredAt}::timestamptz,${entry.locationName},${entry.providerLabel}) ON CONFLICT(shipment_id,milestone_code) DO UPDATE SET occurred_at=EXCLUDED.occurred_at,location_name=EXCLUDED.location_name,provider_label=EXCLUDED.provider_label WHERE (shipment_milestones.occurred_at,shipment_milestones.location_name,shipment_milestones.provider_label) IS DISTINCT FROM (EXCLUDED.occurred_at,EXCLUDED.location_name,EXCLUDED.provider_label)`;
            await tx.shipmentMilestone.deleteMany({
              where: {
                shipmentId: root.id,
                milestoneCode: {
                  notIn: milestones.map((entry) => entry.milestoneCode),
                },
              },
            });
          }
          if (items !== undefined) {
            for (const line of items)
              await tx.$executeRaw`INSERT INTO shipment_items(shipment_id,line_no,name,quantity,unit_value,currency) VALUES(${root.id}::uuid,${line.lineNo},${line.name},${line.quantity},${line.unitValue}::numeric,${line.currency}) ON CONFLICT(shipment_id,line_no) DO UPDATE SET name=EXCLUDED.name,quantity=EXCLUDED.quantity,unit_value=EXCLUDED.unit_value,currency=EXCLUDED.currency WHERE (shipment_items.name,shipment_items.quantity,shipment_items.unit_value,shipment_items.currency) IS DISTINCT FROM (EXCLUDED.name,EXCLUDED.quantity,EXCLUDED.unit_value,EXCLUDED.currency)`;
            await tx.shipmentItem.deleteMany({
              where: { shipmentId: root.id, lineNo: { gt: items.length } },
            });
          }
          if (stageChanged)
            await tx.shipmentStageHistory.create({
              data: {
                shipmentId: root.id,
                sourceVersion: source.sourceVersion,
                processorVersion: version,
                fromStage,
                toStage: fields.logisticsStage,
                providerStatus: root.providerStatus,
                providerChangedAt: providerChangedAt
                  ? new Date(providerChangedAt)
                  : null,
                syncJobId: job.id,
              },
              select: { id: true },
            });
          assertVersion();
        },
        close() {
          active = false;
          proposed = undefined;
        },
      };
    },
  });
}
