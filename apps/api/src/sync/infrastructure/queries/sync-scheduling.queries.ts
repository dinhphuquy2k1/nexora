import { Prisma } from "@nexora/database";
import { ConnectionStatus } from "../../../carrier/domain/carrier";
import { UserStatus } from "../../../identity/domain/user-policy";
import { ACTIVE_SYNC_JOBS } from "../../domain/sync.constants";

/** clock_timestamp() ensures due schedules reflect commit-time DB clock without active-lane conflicts. */
export function buildFindDueSyncSchedulesQuery(params: {
  eligible: string[];
  afterAt: string | null;
  afterId: string | null;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT
      c.user_id,
      c.id,
      s.sync_type,
      c.provider,
      s.id AS config_id,
      s.next_run_at::text AS cursor_at
    FROM sync_configs s
    JOIN carrier_connections c
      ON c.id = s.carrier_connection_id
    JOIN users u
      ON u.id = c.user_id
    WHERE s.enabled
      AND s.next_run_at <= clock_timestamp()
      AND u.status = ${UserStatus.ACTIVE}
      AND c.status = ${ConnectionStatus.CONNECTED}
      AND (c.provider || ':' || s.sync_type) = ANY(${params.eligible}::text[])
      AND (
        ${params.afterAt}::timestamptz IS NULL
        OR (s.next_run_at, s.id) > (
          ${params.afterAt}::timestamptz,
          ${params.afterId}::uuid
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM sync_jobs j
        WHERE j.carrier_connection_id = c.id
          AND j.sync_type = s.sync_type
          AND j.status = ANY(${ACTIVE_SYNC_JOBS}::text[])
      )
    ORDER BY
      s.next_run_at,
      s.id
    LIMIT 100
  `;
}
