import { Prisma } from "@nexora/database";
import {
  ACTIVE_SYNC_JOBS,
  SyncJobStatus as J,
  SyncProcessingStatus as O,
} from "../../domain/sync.constants";

/** SKIP LOCKED avoids blocking cleanup on concurrent terminal-job transactions. */
export function buildClaimCleanupJobsQuery(): Prisma.Sql {
  return Prisma.sql`
    SELECT j.*
    FROM sync_jobs j
    WHERE j.status = ANY(${[J.SUCCEEDED, J.FAILED, J.CANCELLED]}::text[])
      AND (
        EXISTS (
          SELECT 1
          FROM sync_job_seen_pages p
          WHERE p.job_id = j.id
        )
        OR (
          j.scan_scope_fingerprint IS NOT NULL
          AND j.scan_integrity_status IS NULL
        )
      )
    ORDER BY j.id
    LIMIT 20
    FOR UPDATE OF j SKIP LOCKED
  `;
}

/** clock_timestamp() evaluates payload retention cutoff against current DB time. */
export function buildDeleteExpiredPayloadsQuery(params: {
  retentionDays: number;
}): Prisma.Sql {
  return Prisma.sql`
    DELETE FROM provider_source_records p
    WHERE p.id IN (
      SELECT id
      FROM provider_source_records
      WHERE processing_status = ANY(${[O.APPLIED, O.REJECTED_SOURCE]}::text[])
        AND processed_at < clock_timestamp() - ${params.retentionDays} * interval '1 day'
      ORDER BY id
      LIMIT 500
    )
      AND NOT EXISTS (
        SELECT 1
        FROM sync_job_items i
        JOIN sync_jobs j
          ON j.id = i.job_id
        WHERE i.source_identity_id = p.source_identity_id
          AND j.status = ANY(${ACTIVE_SYNC_JOBS}::text[])
      )
  `;
}
