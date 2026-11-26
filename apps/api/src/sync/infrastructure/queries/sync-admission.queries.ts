import { Prisma } from "@nexora/database";
import { SyncJobStatus as J, type SyncType } from "../../domain/sync.constants";

/**
 * Static partial-index predicate preserves PostgreSQL ON CONFLICT inference;
 * covered by integration/fixtures/sync-status-contract.cjs.
 */
export function buildAdmitSyncJobQuery(params: {
  carrierConnectionId: string;
  ownerUserId: string;
  provider: string;
  externalAccountId: string;
  syncType: SyncType;
  triggerSource: string;
  generation: number;
  lifecycleVersion: number;
  fetchStrategy: string;
  scanScopeFingerprint: string | null;
  reconciliationVersion: number | null;
}): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO sync_jobs (
      carrier_connection_id,
      owner_user_id,
      provider,
      external_account_id,
      sync_type,
      trigger_source,
      generation,
      lifecycle_version,
      fetch_strategy,
      target_watermark,
      scan_scope_fingerprint,
      reconciliation_version
    )
    VALUES (
      ${params.carrierConnectionId}::uuid,
      ${params.ownerUserId}::uuid,
      ${params.provider},
      ${params.externalAccountId},
      ${params.syncType},
      ${params.triggerSource},
      ${params.generation},
      ${params.lifecycleVersion},
      ${params.fetchStrategy},
      coalesce(
        (
          SELECT last_completed_watermark
          FROM sync_configs
          WHERE carrier_connection_id = ${params.carrierConnectionId}::uuid
            AND sync_type = ${params.syncType}
        ),
        (
          SELECT target_watermark
          FROM sync_jobs
          WHERE carrier_connection_id = ${params.carrierConnectionId}::uuid
            AND owner_user_id = ${params.ownerUserId}::uuid
            AND sync_type = ${params.syncType}
            AND status = ${J.SUCCEEDED}
          ORDER BY
            finished_at DESC,
            id DESC
          LIMIT 1
        )
      ),
      ${params.scanScopeFingerprint},
      ${params.reconciliationVersion}
    )
    ON CONFLICT (carrier_connection_id, sync_type)
      WHERE status IN ('QUEUED', 'RUNNING', 'WAITING')
    DO NOTHING
    RETURNING *
  `;
}
