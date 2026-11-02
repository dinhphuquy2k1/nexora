import type { Prisma } from "@nexora/database";
import type { SyncDisablementParticipant } from "../application/sync-disablement.port";
import {
  SyncJobStatus as J,
  SyncErrorCode as E,
} from "../domain/sync.constants";
export class TransactionSyncDisablement implements SyncDisablementParticipant {
  constructor(private readonly tx: Prisma.TransactionClient) {}
  async disable(userId: string) {
    await this.tx
      .$executeRaw`UPDATE sync_jobs SET status=${J.CANCELLED},last_error_code=${E.SYNC_STALE},lease_version=lease_version+1,worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),updated_at=clock_timestamp() WHERE owner_user_id=${userId}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
    await this.tx
      .$executeRaw`UPDATE sync_configs SET enabled=false,next_run_at=NULL,updated_at=clock_timestamp() WHERE carrier_connection_id IN (SELECT id FROM carrier_connections WHERE user_id=${userId}::uuid)`;
  }
  async removeConnection(userId: string, id: string) {
    await this.tx
      .$executeRaw`UPDATE sync_jobs SET status=${J.CANCELLED},last_error_code=${E.SYNC_STALE},lease_version=lease_version+1,worker_id=NULL,lease_expires_at=NULL,finished_at=clock_timestamp(),updated_at=clock_timestamp() WHERE owner_user_id=${userId}::uuid AND carrier_connection_id=${id}::uuid AND status IN ('QUEUED','RUNNING','WAITING')`;
  }
}
