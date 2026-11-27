import { Prisma } from "@nexora/database";
import { SyncJobStatus as J } from "../../domain/sync.constants";

/**
 * SKIP LOCKED claims the next available/expired job without blocking on locked rows;
 * clock_timestamp() prevents stale transaction-start timestamps from misclassifying leases.
 */
export function buildClaimCandidateQuery(params: {
  eligible: string[];
  scope?: Prisma.Sql;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT j.*
    FROM sync_jobs j
    WHERE (provider || ':' || sync_type) = ANY(${params.eligible}::text[])
      AND (${params.scope ?? Prisma.sql`TRUE`})
      AND (
        (
          status = ANY(${[J.QUEUED, J.WAITING]}::text[])
          AND available_at <= clock_timestamp()
        )
        OR (
          status = ${J.RUNNING}
          AND lease_expires_at <= clock_timestamp()
        )
      )
    ORDER BY
      available_at,
      id
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  `;
}
