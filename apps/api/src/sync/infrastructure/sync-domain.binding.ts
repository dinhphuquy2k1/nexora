import type { Prisma } from "@nexora/database";
import type {
  SyncDecision,
  SyncJob,
  SyncSource,
} from "../application/sync.port";
import type { SyncType } from "../domain/sync.constants";

/** Infrastructure-only invocation; processors never receive the transaction. */
export interface BoundDomainExecution {
  decide(): Promise<SyncDecision>;
  /** Must reject missing proposals and verify the actual scoped persistence result. */
  commit(): Promise<void>;
  close(): void;
}
export interface FinalizationFacts {
  readonly admitted: boolean;
  readonly scan?: import("../application/sync.port").FullScanContract;
  readonly scanValidated: boolean;
  readonly scopeMatches: boolean;
}
export interface SyncDomainBinding {
  readonly finalizationVersion?: number;
  finalize?(
    tx: Prisma.TransactionClient,
    job: SyncJob,
    facts: FinalizationFacts,
  ): Promise<
    import("../domain/sync-reconciliation.constants").ReconciliationSummary
  >;

  readonly version: number;
  supports(type: SyncType): boolean;
  begin(
    tx: Prisma.TransactionClient,
    job: SyncJob,
    source: SyncSource,
    authorizationLocks: "exclusive" | "shared",
  ): Promise<BoundDomainExecution>;
}
