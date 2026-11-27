import { Prisma } from "@nexora/database";
import {
  SyncProcessingStatus as O,
  type SyncType,
} from "../../domain/sync.constants";

/** Lock matched source identity rows before computing versions and payload diffs. */
export function buildLockExistingIdentitiesQuery(params: {
  input: string;
  ownerUserId: string;
  provider: string;
  externalAccountId: string;
  syncType: SyncType;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT s.*
    FROM sync_source_identities s
    JOIN jsonb_to_recordset(${params.input}::jsonb) AS r(scheme text, hash text)
      ON s.source_key_scheme = r.scheme
      AND s.source_key_hash = r.hash
    WHERE owner_user_id = ${params.ownerUserId}::uuid
      AND provider = ${params.provider}
      AND external_account_id = ${params.externalAccountId}
      AND sync_type = ${params.syncType}
    FOR UPDATE OF s
  `;
}

/** Upsert observed source identities; clock_timestamp() records commit-time update timestamp. */
export function buildUpsertSyncSourceIdentitiesQuery(params: {
  ownerUserId: string;
  provider: string;
  externalAccountId: string;
  syncType: SyncType;
  data: string;
}): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO sync_source_identities (
      owner_user_id,
      provider,
      external_account_id,
      sync_type,
      source_key_scheme,
      source_key,
      source_key_hash,
      last_observed_hash,
      observed_source_version,
      last_source_order
    )
    SELECT
      ${params.ownerUserId}::uuid,
      ${params.provider},
      ${params.externalAccountId},
      ${params.syncType},
      scheme,
      key,
      hash,
      "payloadHash",
      version,
      "sourceOrder"
    FROM jsonb_to_recordset(${params.data}::jsonb) AS r(
      scheme text,
      key text,
      hash text,
      "payloadHash" text,
      version int,
      "sourceOrder" bigint,
      stale boolean
    )
    WHERE NOT stale
    ON CONFLICT (
      owner_user_id,
      provider,
      external_account_id,
      sync_type,
      source_key_scheme,
      source_key_hash
    )
    DO UPDATE SET
      last_observed_hash = excluded.last_observed_hash,
      observed_source_version = excluded.observed_source_version,
      last_source_order = coalesce(
        excluded.last_source_order,
        sync_source_identities.last_source_order
      ),
      updated_at = clock_timestamp()
    WHERE sync_source_identities.source_key = excluded.source_key
      AND (
        sync_source_identities.last_observed_hash IS DISTINCT FROM excluded.last_observed_hash
        OR (
          excluded.last_source_order IS NOT NULL
          AND (
            sync_source_identities.last_source_order IS NULL
            OR excluded.last_source_order > sync_source_identities.last_source_order
          )
        )
      )
  `;
}

/** Stage normalized provider payloads monotonically by source/processor version; clock_timestamp() records staging time. */
export function buildUpsertProviderSourceRecordsQuery(params: {
  ownerUserId: string;
  provider: string;
  externalAccountId: string;
  syncType: SyncType;
  processorVersion: number;
  data: string;
}): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO provider_source_records (
      source_identity_id,
      normalized_payload,
      payload_hash,
      source_version,
      processor_version
    )
    SELECT
      s.id,
      r.payload::jsonb,
      r."payloadHash",
      r.version,
      ${params.processorVersion}
    FROM jsonb_to_recordset(${params.data}::jsonb) AS r(
      scheme text,
      hash text,
      payload text,
      "payloadHash" text,
      version int,
      stale boolean
    )
    JOIN sync_source_identities s
      ON s.source_key_scheme = r.scheme
      AND s.source_key_hash = r.hash
      AND s.owner_user_id = ${params.ownerUserId}::uuid
      AND s.provider = ${params.provider}
      AND s.external_account_id = ${params.externalAccountId}
      AND s.sync_type = ${params.syncType}
    WHERE NOT r.stale
      AND (
        s.last_resolved_hash IS DISTINCT FROM r."payloadHash"
        OR s.resolved_processor_version IS DISTINCT FROM ${params.processorVersion}
        OR EXISTS (
          SELECT 1
          FROM provider_source_records p
          WHERE p.source_identity_id = s.id
        )
      )
    ON CONFLICT (source_identity_id)
    DO UPDATE SET
      normalized_payload = CASE
        WHEN provider_source_records.payload_hash IS DISTINCT FROM excluded.payload_hash
          THEN excluded.normalized_payload
        ELSE provider_source_records.normalized_payload
      END,
      payload_hash = excluded.payload_hash,
      source_version = excluded.source_version,
      processor_version = excluded.processor_version,
      processing_status = ${O.PENDING},
      attempt_count = 0,
      last_error_code = NULL,
      next_retry_at = NULL,
      updated_at = clock_timestamp()
    WHERE provider_source_records.source_version < excluded.source_version
      OR provider_source_records.processor_version < excluded.processor_version
  `;
}

export function buildInsertSyncJobItemsQuery(params: {
  jobId: string;
  ownerUserId: string;
  provider: string;
  externalAccountId: string;
  syncType: SyncType;
  data: string;
}): Prisma.Sql {
  return Prisma.sql`
    INSERT INTO sync_job_items (
      job_id,
      source_identity_id,
      source_version,
      processor_version
    )
    SELECT
      ${params.jobId}::uuid,
      p.source_identity_id,
      p.source_version,
      p.processor_version
    FROM provider_source_records p
    JOIN sync_source_identities s
      ON s.id = p.source_identity_id
    JOIN jsonb_to_recordset(${params.data}::jsonb) AS r(
      scheme text,
      hash text,
      stale boolean
    )
      ON s.source_key_scheme = r.scheme
      AND s.source_key_hash = r.hash
    WHERE s.owner_user_id = ${params.ownerUserId}::uuid
      AND s.provider = ${params.provider}
      AND s.external_account_id = ${params.externalAccountId}
      AND s.sync_type = ${params.syncType}
      AND NOT r.stale
      AND p.processing_status = ANY(${[O.PENDING, O.RETRYABLE_ERROR]}::text[])
    ON CONFLICT DO NOTHING
  `;
}

/** Fence page progress update to the active lease_version. */
export function buildAdvancePageJobQuery(params: {
  jobId: string;
  leaseVersion: number;
  expectedScope: string | null;
  scanIntegrityStatus: string | null;
  hasSummary: boolean;
  scanIntegrityReason: string | null;
  scanObservedCount: number | null;
  scanReportedTotal: number | null;
  nextPage: number;
  nextCursor: string | null;
  targetWatermark: string | null;
  processingPhase: string;
  fetchedIncrement: number;
  newIncrement: number;
  changedIncrement: number;
  unchangedIncrement: number;
}): Prisma.Sql {
  return Prisma.sql`
    UPDATE sync_jobs
    SET
      scan_scope_fingerprint = coalesce(scan_scope_fingerprint, ${params.expectedScope}),
      scan_integrity_status = coalesce(${params.scanIntegrityStatus}, scan_integrity_status),
      scan_integrity_reason = CASE
        WHEN ${params.hasSummary} THEN ${params.scanIntegrityReason}
        ELSE scan_integrity_reason
      END,
      scan_observed_count = coalesce(${params.scanObservedCount}::int, scan_observed_count),
      scan_reported_total = CASE
        WHEN ${params.hasSummary} THEN ${params.scanReportedTotal}::int
        ELSE scan_reported_total
      END,
      next_page = ${params.nextPage},
      next_cursor = ${params.nextCursor},
      target_watermark = ${params.targetWatermark},
      processing_phase = ${params.processingPhase},
      fetched_count = fetched_count + ${params.fetchedIncrement},
      new_count = new_count + ${params.newIncrement},
      changed_count = changed_count + ${params.changedIncrement},
      unchanged_count = unchanged_count + ${params.unchangedIncrement},
      attempt_count = 0
    WHERE id = ${params.jobId}::uuid
      AND lease_version = ${params.leaseVersion}
  `;
}
