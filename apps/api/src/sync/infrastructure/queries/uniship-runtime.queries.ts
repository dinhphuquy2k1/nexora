import { Prisma } from "@nexora/database";
import { ConnectionStatus } from "../../../carrier/domain/carrier";
import { UserStatus } from "../../../identity/domain/user-policy";
import {
  SyncType,
  SyncTrigger,
  SyncJobStatus,
  SyncErrorCode,
  ACTIVE_SYNC_JOBS,
} from "../../domain/sync.constants";
/** Scope filtering happens before candidate LIMIT, so unapproved AUTO jobs cannot starve the lane. */
export function buildUnishipJobCandidatesQuery(
  scope: Prisma.Sql,
  automatic: boolean,
): Prisma.Sql {
  return Prisma.sql`EXISTS(
  SELECT 1
  FROM carrier_connections c
  JOIN users u ON u.id=c.user_id
  LEFT JOIN sync_configs s
    ON s.carrier_connection_id=c.id
    AND s.sync_type=j.sync_type
  WHERE c.id=j.carrier_connection_id
    AND c.user_id=j.owner_user_id
    AND ${scope}
    AND j.provider=c.provider
    AND j.external_account_id=c.external_account_id
    AND j.sync_type=${SyncType.SHIPMENT}
    AND u.status=${UserStatus.ACTIVE}
    AND c.status=${ConnectionStatus.CONNECTED}
    AND (j.trigger_source=${SyncTrigger.MANUAL} OR (
      ${automatic}
      AND j.trigger_source=${SyncTrigger.AUTO}
      AND s.interval_minutes>=60
    ))
 )`;
}
/** Revoke only this locked blocked AUTO version; DB clock and lease bump fence its previous worker. */
export function buildCancelBlockedAutoQuery(
  id: string,
  leaseVersion: number,
): Prisma.Sql {
  return Prisma.sql`
  UPDATE sync_jobs
  SET
    status=${SyncJobStatus.CANCELLED},
    last_error_code=${SyncErrorCode.SYNC_UNAVAILABLE},
    lease_version=lease_version+1,
    worker_id=NULL,
    lease_expires_at=NULL,
    finished_at=clock_timestamp(),
    updated_at=clock_timestamp()
  WHERE id=${id}::uuid
    AND lease_version=${leaseVersion}
    AND trigger_source=${SyncTrigger.AUTO}
    AND status=ANY(${ACTIVE_SYNC_JOBS}::text[])
 `;
}
