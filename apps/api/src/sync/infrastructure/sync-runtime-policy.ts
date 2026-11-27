import type { Prisma } from "@nexora/database";
import type { SyncType } from "../domain/sync.constants";
export interface SyncRuntimeConnection {
  readonly id: string;
  readonly user_id: string;
  readonly provider: string;
  readonly external_account_id: string;
}
/** Trusted runtime eligibility, separate from provider/type capability resolution. */
export interface SyncRuntimePolicy {
  readonly jobCandidates: Prisma.Sql;
  readonly scheduleCandidates: Prisma.Sql;
  accepts(
    tx: Prisma.TransactionClient,
    connection: SyncRuntimeConnection,
    type: SyncType,
    trigger: string,
    phase: "admit" | "execute",
  ): Promise<boolean>;
}
