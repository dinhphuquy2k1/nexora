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
type Tx = Prisma.TransactionClient;

/** Exact scoped expressions shared with the disposable EXPLAIN benchmark. */
export function shipmentReconciliationQueries(job: SyncJob, scheme: string) {
  const source = Prisma.sql`s.owner_user_id=${job.owner_user_id}::uuid AND s.provider=${job.provider}
    AND s.external_account_id=${job.external_account_id} AND s.sync_type=${SyncType.SHIPMENT} AND s.source_key_scheme=${scheme}`;
  const scope = Prisma.sql`${source} AND p.owner_user_id=${job.owner_user_id}::uuid AND p.provider=${job.provider}`;
  const seen = Prisma.sql`SELECT DISTINCT u.id FROM sync_job_seen_pages pages
    CROSS JOIN LATERAL unnest(pages.source_identity_ids) u(id) WHERE pages.job_id=${job.id}::uuid`;
  const candidates = Prisma.sql`SELECT p.id,p.source_identity_id,p.sync_hidden_at,p.missing_streak,p.carrier_connection_id
    FROM sync_source_identities s JOIN shipments p ON p.source_identity_id=s.id WHERE ${scope}`;
  const missing = Prisma.sql`WITH seen AS MATERIALIZED (${seen})
    SELECT p.id FROM sync_source_identities s JOIN shipments p ON p.source_identity_id=s.id
    WHERE ${scope} AND NOT EXISTS(SELECT 1 FROM seen v WHERE v.id=s.id)`;
  const restore = Prisma.sql`WITH seen AS MATERIALIZED (${seen})
    SELECT p.id FROM sync_source_identities s JOIN shipments p ON p.source_identity_id=s.id
    WHERE ${scope} AND p.sync_hidden_at IS NOT NULL AND EXISTS(SELECT 1 FROM seen v WHERE v.id=s.id)`;
  return {
    sourceLocks: Prisma.sql`WITH locked AS MATERIALIZED (SELECT s.id FROM sync_source_identities s
      WHERE ${source} ORDER BY s.id FOR UPDATE OF s) SELECT count(*)::int AS count FROM locked`,
    conflicts: Prisma.sql`SELECT count(*)::int AS count FROM sync_source_identities s JOIN shipments p ON p.source_identity_id=s.id
      WHERE ${source} AND (p.owner_user_id<>${job.owner_user_id}::uuid OR p.provider IS DISTINCT FROM ${job.provider}
        OR (p.carrier_connection_id IS NOT NULL AND p.carrier_connection_id<>${job.carrier_connection_id}::uuid))`,
    candidates,
    missing,
    restore,
    facts: Prisma.sql`WITH seen AS MATERIALIZED (${seen}), candidates AS MATERIALIZED (${candidates} ORDER BY p.id FOR UPDATE OF p)
      SELECT count(*)::int AS "eligibleShipments",
      count(*) FILTER(WHERE c.sync_hidden_at IS NULL)::int AS "currentlyVisible",
      count(*) FILTER(WHERE c.sync_hidden_at IS NULL AND v.id IS NULL)::int AS "newlyMissing",
      count(*) FILTER(WHERE c.sync_hidden_at IS NOT NULL AND v.id IS NULL)::int AS "alreadyHiddenMissing",
      count(*) FILTER(WHERE c.sync_hidden_at IS NOT NULL AND v.id IS NOT NULL)::int AS restorable,
      coalesce(max(c.missing_streak) FILTER(WHERE v.id IS NULL),0)::int AS "maxMissingStreak"
      FROM candidates c LEFT JOIN seen v ON v.id=c.source_identity_id`,
    mutation: Prisma.sql`WITH seen AS MATERIALIZED (${seen}), changes AS MATERIALIZED (
      SELECT p.id,p.sync_hidden_at AS old_hidden,(v.id IS NOT NULL) AS present
      FROM sync_source_identities s JOIN shipments p ON p.source_identity_id=s.id
      LEFT JOIN seen v ON v.id=s.id WHERE ${scope} AND (v.id IS NULL OR p.sync_hidden_at IS NOT NULL)
    ), changed AS (
      UPDATE shipments p SET
        sync_hidden_at=CASE WHEN c.present THEN NULL ELSE coalesce(p.sync_hidden_at,clock_timestamp()) END,
        missing_streak=CASE WHEN c.present THEN 0 ELSE p.missing_streak+1 END
      FROM changes c WHERE p.id=c.id RETURNING c.old_hidden,c.present
    ) SELECT count(*) FILTER(WHERE NOT present AND old_hidden IS NULL)::int AS "newlyHidden",
      count(*) FILTER(WHERE present)::int AS restored,
      count(*) FILTER(WHERE NOT present AND old_hidden IS NOT NULL)::int AS "stillMissing" FROM changed`,
  };
}
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
    >`SELECT scan_scope_fingerprint AS fingerprint,scan_observed_count AS observed
      FROM sync_jobs WHERE owner_user_id=${job.owner_user_id}::uuid AND provider=${job.provider}
      AND external_account_id=${job.external_account_id} AND sync_type=${job.sync_type} AND status=${SyncJobStatus.SUCCEEDED}
      AND reconciliation_version=${job.reconciliation_version} AND scan_integrity_status=${SyncScanIntegrityStatus.VALIDATED} AND reconciliation_status=ANY(${[S.BASELINE_ESTABLISHED, S.APPLIED]}::text[])
      AND id<>${job.id}::uuid ORDER BY finished_at DESC,id DESC LIMIT 1`;
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
