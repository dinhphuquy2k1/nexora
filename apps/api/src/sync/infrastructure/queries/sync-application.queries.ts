import { Prisma } from "@nexora/database";
import type { SyncType } from "../../domain/sync.constants";

/** Lock source identity and staged provider record together to serialize domain apply. */
export function buildLockSourceRecordForApplyQuery(params: {
  sourceIdentityId: string;
  ownerUserId: string;
  provider: string;
  externalAccountId: string;
  syncType: SyncType;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT
      s.id,
      p.normalized_payload,
      p.source_version,
      p.processor_version,
      p.payload_hash
    FROM sync_source_identities s
    JOIN provider_source_records p
      ON p.source_identity_id = s.id
    WHERE s.id = ${params.sourceIdentityId}::uuid
      AND s.owner_user_id = ${params.ownerUserId}::uuid
      AND s.provider = ${params.provider}
      AND s.external_account_id = ${params.externalAccountId}
      AND s.sync_type = ${params.syncType}
    FOR UPDATE OF s, p
  `;
}

/** Record terminal item outcome on provider_source_records; clock_timestamp() captures commit-time processing timestamp. */
export function buildMarkSourceRecordResolvedQuery(params: {
  sourceIdentityId: string;
  sourceVersion: number;
  processorVersion: number;
  outcome: string;
  applied: boolean;
  errorCode: string | null;
}): Prisma.Sql {
  return Prisma.sql`
    UPDATE provider_source_records
    SET
      processing_status = ${params.outcome},
      applied_version = CASE
        WHEN ${params.applied} THEN source_version
        ELSE applied_version
      END,
      resolved_version = source_version,
      applied_processor_version = CASE
        WHEN ${params.applied} THEN processor_version
        ELSE applied_processor_version
      END,
      last_error_code = ${params.errorCode},
      processed_at = clock_timestamp(),
      attempt_count = attempt_count + 1
    WHERE source_identity_id = ${params.sourceIdentityId}::uuid
      AND source_version = ${params.sourceVersion}
      AND processor_version = ${params.processorVersion}
  `;
}

/** Fence WAITING reschedule to lease_version; clock_timestamp() anchors retry availability to commit-time DB clock. */
export function buildRescheduleApplyWaitQuery(params: {
  jobId: string;
  leaseVersion: number;
  ready: Prisma.Sql;
  eligible: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`
    UPDATE sync_jobs
    SET
      available_at = CASE
        WHEN EXISTS (
          SELECT 1
          FROM sync_job_items i
          JOIN provider_source_records p
            ON p.source_identity_id = i.source_identity_id
          WHERE i.job_id = ${params.jobId}::uuid
            AND ${params.ready}
        ) THEN clock_timestamp()
        ELSE coalesce(
          (
            SELECT min(p.next_retry_at)
            FROM sync_job_items i
            JOIN provider_source_records p
              ON p.source_identity_id = i.source_identity_id
            WHERE i.job_id = ${params.jobId}::uuid
              AND ${params.eligible}
          ),
          clock_timestamp()
        )
      END
    WHERE id = ${params.jobId}::uuid
      AND lease_version = ${params.leaseVersion}
  `;
}
