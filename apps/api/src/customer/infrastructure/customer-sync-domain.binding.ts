import { isUuid } from "../../common/validation/uuid";
import type { SyncDomainProcessor } from "../../sync/application/sync.port";
import { SyncError } from "../../sync/domain/sync-policy";
import {
  SyncErrorCode as E,
  SyncLinkOrigin,
} from "../../sync/domain/sync.constants";
import type { SyncDomainBinding } from "../../sync/infrastructure/sync-domain.binding";
import type { CustomerSyncSession } from "../application/customer-sync.port";

/** Existing-link persistence only: no Customer create/update grants or matching policy. */
export function createCustomerSyncBinding(
  processor: SyncDomainProcessor<CustomerSyncSession>,
): SyncDomainBinding {
  const version = processor.version;
  return Object.freeze<SyncDomainBinding>({
    version,
    supports: (type) =>
      processor.version === version && processor.supports(type),
    async begin(tx, job, source, authorizationLocks) {
      const assertVersion = () => {
        if (processor.version !== version || !processor.supports(job.sync_type))
          throw new SyncError(E.PROCESSOR_UNAVAILABLE);
      };
      assertVersion();
      if (!job.carrier_connection_id) throw new SyncError(E.SYNC_STALE);
      const rows = await tx.$queryRaw<
        { customer_id: string | null }[]
      >`SELECT customer_id FROM sync_source_identities WHERE id=${source.id}::uuid AND owner_user_id=${job.owner_user_id}::uuid AND provider=${job.provider} AND external_account_id=${job.external_account_id} AND sync_type=${job.sync_type}`;
      if (rows.length !== 1) throw new SyncError(E.SOURCE_CONFLICT);
      const sourceId = source.id,
        ownerId = job.owner_user_id,
        existingId = rows[0].customer_id;
      let active = true,
        proposedId: string | null = null;
      const assertActive = () => {
        if (!active) throw new SyncError(E.SYNC_STALE);
      };
      const assertTarget = (id: string) => {
        assertActive();
        if (
          !isUuid(id) ||
          (existingId && existingId !== id) ||
          (proposedId && proposedId !== id)
        )
          throw new SyncError(E.SOURCE_CONFLICT);
      };
      const session: CustomerSyncSession = Object.freeze({
        scope: Object.freeze({
          ownerId,
          connectionId: job.carrier_connection_id,
          sourceId,
          provider: job.provider,
          externalAccountId: job.external_account_id,
          syncType: job.sync_type,
        }),
        existingCustomerId: existingId,
        async linkExistingCustomer(id: string) {
          assertTarget(id);
          const customers =
            authorizationLocks === "shared"
              ? await tx.$queryRaw<
                  { id: string }[]
                >`SELECT id FROM public.sync_lock_customer(${id}::uuid,${ownerId}::uuid)`
              : await tx.$queryRaw<
                  { id: string }[]
                >`SELECT id FROM customers WHERE id=${id}::uuid AND owner_user_id=${ownerId}::uuid FOR UPDATE`;
          assertTarget(id);
          if (customers.length !== 1) throw new SyncError(E.SOURCE_CONFLICT);
          proposedId = id;
        },
      });
      return {
        async decide() {
          assertActive();
          assertVersion();
          const decision = await processor.apply(source, session);
          assertVersion();
          return decision;
        },
        async commit() {
          assertActive();
          assertVersion();
          if (!proposedId) throw new SyncError(E.PROCESSOR_UNAVAILABLE);
          active = false;
          const changed =
            await tx.$executeRaw`UPDATE sync_source_identities SET customer_id=${proposedId}::uuid,link_origin=${SyncLinkOrigin.LINKED_EXISTING} WHERE id=${sourceId}::uuid AND owner_user_id=${ownerId}::uuid`;
          assertVersion();
          if (changed !== 1) throw new SyncError(E.SOURCE_CONFLICT);
        },
        close() {
          active = false;
        },
      };
    },
  });
}
