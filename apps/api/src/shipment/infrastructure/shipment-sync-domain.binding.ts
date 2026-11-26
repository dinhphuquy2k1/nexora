import { createShipmentReconciler } from "./shipment-reconciliation";
import type { ShipmentReconciliationPolicy } from "../domain/shipment-reconciliation";
import type { LogisticsStageCode } from "@nexora/shared/shipment";
import { persistShipmentProvider } from "./shipment-provider.persistence";
import { hydrateShipment } from "./shipment.mapper";
import {
  buildUpsertChargesQuery,
  buildUpsertItemsQuery,
  buildUpsertMilestonesQuery,
  buildUpsertServicesQuery,
} from "./queries/shipment-children.queries";
import type { SyncDomainProcessor } from "../../sync/application/sync.port";
import type { SyncDomainBinding } from "../../sync/infrastructure/sync-domain.binding";
import { SyncError } from "../../sync/domain/sync-policy";
import { SyncErrorCode as E, SyncType } from "../../sync/domain/sync.constants";
import { ShipmentAggregate, type ProviderOperation } from "../domain/shipment";
import type { ShipmentSyncSession } from "../application/shipment-sync.port";
/** Transaction and source lock are owned by Sync; never create another client here. */
export function createShipmentSyncBinding(
  processor: SyncDomainProcessor<ShipmentSyncSession>,
  reconciliation?: ShipmentReconciliationPolicy,
): SyncDomainBinding {
  const version = processor.version;
  return Object.freeze<SyncDomainBinding>({
    version,
    finalizationVersion: 1,
    finalize: createShipmentReconciler(reconciliation),
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
      // Lock source identity and provider record first to maintain source -> shipment lock order.
      const scoped = await tx.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM sync_source_identities s
        JOIN provider_source_records p
          ON p.source_identity_id = s.id
        WHERE s.id = ${source.id}::uuid
          AND s.owner_user_id = ${job.owner_user_id}::uuid
          AND s.provider = ${job.provider}
          AND s.external_account_id = ${job.external_account_id}
          AND s.sync_type = ${SyncType.SHIPMENT}
          AND p.source_version = ${source.sourceVersion}
          AND p.processor_version = ${version}
        FOR UPDATE OF s, p
      `;
      if (scoped.length !== 1) throw new SyncError(E.SOURCE_CONFLICT);
      // Lock shipment root after source lock to serialize root/child mutations.
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM shipments
        WHERE source_identity_id = ${source.id}::uuid
          AND owner_user_id = ${job.owner_user_id}::uuid
        FOR UPDATE
      `;
      const existing = locked.length
        ? await tx.shipment.findUniqueOrThrow({
            where: { id: locked[0].id },
            include: {
              charges: { orderBy: { lineNo: "asc" } },
              milestones: true,
              services: true,
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
        existingLogisticsStage: existing
          ? (existing.logisticsStage as LogisticsStageCode)
          : null,
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
            services,
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
            if (charges.length)
              await tx.$executeRaw(buildUpsertChargesQuery(root.id, charges));
            await tx.shipmentCharge.deleteMany({
              where: { shipmentId: root.id, lineNo: { gt: charges.length } },
            });
          }
          if (milestones !== undefined) {
            if (milestones.length)
              await tx.$executeRaw(
                buildUpsertMilestonesQuery(root.id, milestones),
              );
            await tx.shipmentMilestone.deleteMany({
              where: {
                shipmentId: root.id,
                milestoneCode: {
                  notIn: milestones.map((entry) => entry.milestoneCode),
                },
              },
            });
          }
          if (services !== undefined) {
            if (services.length)
              await tx.$executeRaw(buildUpsertServicesQuery(root.id, services));
            await tx.shipmentService.deleteMany({
              where: {
                shipmentId: root.id,
                serviceCode: {
                  notIn: services.map((entry) => entry.serviceCode),
                },
              },
            });
          }
          if (items !== undefined) {
            if (items.length)
              await tx.$executeRaw(buildUpsertItemsQuery(root.id, items));
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
