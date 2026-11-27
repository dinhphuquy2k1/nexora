import { SyncScanIntegrityStatus } from "../../sync/domain/sync-observation.constants";
import { Prisma } from "@nexora/database";
import type { SyncJob } from "../../sync/application/sync.port";
import type { FinalizationFacts } from "../../sync/infrastructure/sync-domain.binding";
import { CarrierProvider } from "../../carrier/domain/carrier";
import {
  SyncType,
  SyncStrategy,
  SyncJobStatus,
} from "../../sync/domain/sync.constants";
import { ReconciliationStatus as S } from "../../sync/domain/sync-reconciliation.constants";
import { SyncError } from "../../sync/domain/sync-policy";
import { SyncErrorCode } from "../../sync/domain/sync.constants";
import {
  decideShipmentReconciliation,
  reconciliationPolicy,
  type ShipmentReconciliationPolicy,
  type ShipmentReconciliationFacts,
} from "../domain/shipment-reconciliation";
import { shipmentReconciliationQueries } from "./queries/shipment-reconciliation.queries";
export { shipmentReconciliationQueries };
type Tx = Prisma.TransactionClient;
export function createShipmentReconciler(
  configuration?: ShipmentReconciliationPolicy,
) {
  const policy = reconciliationPolicy(configuration);
  return async (tx: Tx, job: SyncJob, technical: FinalizationFacts) => {
    const facts: ShipmentReconciliationFacts = {
      admitted: technical.admitted,
      eligible:
        technical.scanValidated &&
        job.provider === CarrierProvider.UNISHIP &&
        job.sync_type === SyncType.SHIPMENT &&
        job.fetch_strategy === SyncStrategy.FULL &&
        technical.scan?.sourceKeyScheme === "uniship-parcel-v1" &&
        technical.scan.pageSize === 100,
      scopeMatches: technical.scopeMatches,
      fingerprint: job.scan_scope_fingerprint ?? null,
      baseline: null,
      eligibleShipments: 0,
      currentlyVisible: 0,
      newlyMissing: 0,
      alreadyHiddenMissing: 0,
      restorable: 0,
      maxMissingStreak: 0,
      conflicts: 0,
      currentObserved: job.scan_observed_count ?? 0,
    };
    if (!facts.admitted || !facts.eligible || !facts.scopeMatches || !policy)
      return decideShipmentReconciliation(facts, policy);
    const queries = shipmentReconciliationQueries(
      job,
      technical.scan!.sourceKeyScheme,
    );
    await tx.$queryRaw(queries.sourceLocks);
    const [conflicts] = await tx.$queryRaw<{ count: number }[]>(
      queries.conflicts,
    );
    facts.conflicts = conflicts.count;
    if (facts.conflicts) return decideShipmentReconciliation(facts, policy);
    const [counts] = await tx.$queryRaw<
      Pick<
        ShipmentReconciliationFacts,
        | "eligibleShipments"
        | "currentlyVisible"
        | "newlyMissing"
        | "alreadyHiddenMissing"
        | "restorable"
        | "maxMissingStreak"
      >[]
    >(queries.facts);
    Object.assign(facts, counts);
    const baseline = await tx.$queryRaw<
      { fingerprint: string; observed: number }[]
    >`
      SELECT
        scan_scope_fingerprint AS fingerprint,
        scan_observed_count AS observed
      FROM sync_jobs
      WHERE owner_user_id = ${job.owner_user_id}::uuid
        AND provider = ${job.provider}
        AND external_account_id = ${job.external_account_id}
        AND sync_type = ${job.sync_type}
        AND status = ${SyncJobStatus.SUCCEEDED}
        AND reconciliation_version = ${job.reconciliation_version}
        AND scan_integrity_status = ${SyncScanIntegrityStatus.VALIDATED}
        AND reconciliation_status = ANY(${[S.BASELINE_ESTABLISHED, S.APPLIED]}::text[])
        AND id <> ${job.id}::uuid
      ORDER BY
        finished_at DESC,
        id DESC
      LIMIT 1
    `;
    facts.baseline = baseline[0] ?? null;
    const decision = decideShipmentReconciliation(facts, policy);
    if (decision.status === S.APPLIED) {
      const [changed] = await tx.$queryRaw<
        { newlyHidden: number; restored: number; stillMissing: number }[]
      >(queries.mutation);
      if (
        changed.newlyHidden !== decision.newlyHidden ||
        changed.restored !== decision.restored ||
        changed.stillMissing !== decision.stillMissing
      )
        throw new SyncError(SyncErrorCode.SOURCE_CONFLICT);
    }
    return decision;
  };
}
